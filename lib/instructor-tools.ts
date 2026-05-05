/**
 * Instructor tool surface — all eight functions with clean signatures.
 * Called directly by the instructor UI (when an instructor edits a field),
 * and will be called by the calibration agent when it ships.
 *
 * Intentionally separated from HTTP routing — pure functions over the data model.
 */

import { createChatCompletion } from './chat-completion'
import {
  listChunks,
  listCourseConcepts,
  getOrCreateAgentState,
  updateAgentState,
  createCalibrationVersion,
  getActiveCalibration,
  getActiveRubric,
  createRubricVersion,
  getCalibrationVersion,
  updateCalibrationField,
  newId,
} from './db'
import { readSourceText } from './source-ingestion'
import { getTemplate } from './rubric-templates'
import type {
  RubricDimension,
  RubricVersion,
  CalibrationVersion,
  SeedQuestion,
  ReasoningLogEntry,
} from './db'

const QUESTION_BUDGET = 3

// ── Types ──────────────────────────────────────────────────────────────────────

export type Concept = { label: string; chunkIds: string[] }

export type SeedQuestionProposal = {
  id: string
  text: string
  type: 'factual' | 'conceptual' | 'applied' | 'analytical'
  dimension_targeted: string
  instructor_approved: boolean
}

export type InputRequestId = string

export type WidgetType = 'slider' | 'multi_select' | 'rate_items' | 'free_text'

export type InputRequest = {
  request_id: InputRequestId
  course_id: string
  field: string
  widget_type: WidgetType
  widget_config: Record<string, unknown>
}

// ── 1. read_source ─────────────────────────────────────────────────────────────

export function read_source(sourceId: string, pageRange?: [number, number]): string {
  return readSourceText(sourceId, pageRange)
}

// ── 2. extract_concepts ────────────────────────────────────────────────────────

export function extract_concepts(sourceId: string): Concept[] {
  return listCourseConcepts(sourceId).map(c => ({ label: c.label, chunkIds: c.chunkIds }))
}

// ── 3. propose_seed_questions ─────────────────────────────────────────────────

export async function propose_seed_questions(
  courseId: string,
  n: number,
  depthBreadth: number,
  focusConcepts?: string[]
): Promise<SeedQuestionProposal[]> {
  const allConcepts = listCourseConcepts(courseId)
  const conceptList = (focusConcepts?.length
    ? allConcepts.filter(c => focusConcepts.includes(c.label))
    : allConcepts
  ).map(c => c.label)

  const depthPrompt = depthBreadth > 0.7
    ? 'Favor deep, precise questions on a small number of high-priority concepts.'
    : depthBreadth < 0.3
    ? 'Favor broad survey questions covering many concepts.'
    : 'Balance depth and breadth across concepts.'

  const response = await createChatCompletion({
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Generate ${n} practice oral exam seed questions for a course.

Concepts: ${conceptList.join(', ')}

Style: ${depthPrompt}

Return ONLY valid JSON, no other text:
{"questions": [
  {
    "text": "question text",
    "type": "factual|conceptual|applied|analytical",
    "dimension_targeted": "organization|language|supporting_material|central_message"
  }
]}`,
    }],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  let parsed: { questions: { text: string; type: string; dimension_targeted: string }[] }
  try {
    parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as typeof parsed
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = m ? JSON.parse(m[0]) as typeof parsed : { questions: [] }
  }

  return (parsed.questions ?? []).slice(0, n).map(q => ({
    id: newId(),
    text: q.text,
    type: q.type as SeedQuestionProposal['type'],
    dimension_targeted: q.dimension_targeted,
    instructor_approved: false,
  }))
}

// ── 4. generate_rubric ─────────────────────────────────────────────────────────

export async function generate_rubric(
  courseId: string,
  sourceIds: string[],
  style: 'stanford_oral_comm' | 'discipline_specific' | 'custom'
): Promise<RubricVersion> {
  if (style === 'stanford_oral_comm') {
    const template = getTemplate('stanford_oral_comm')!
    return createRubricVersion(courseId, 'template', template.dimensions, template.origin, 'stanford_oral_comm')
  }

  // Read source material for discipline-specific generation
  const sourceText = sourceIds
    .map(id => readSourceText(id))
    .join('\n\n')
    .slice(0, 5000)

  const response = await createChatCompletion({
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Generate a rubric for oral communication assessment based on this course material.

Material excerpt:
${sourceText}

Generate 4–5 rubric dimensions appropriate to this discipline. Each dimension needs 4 proficiency levels (Basic→Mastery). Weights must sum to 1.0.

Return ONLY valid JSON:
{
  "dimensions": [
    {
      "id": "snake_case_id",
      "name": "Dimension Name",
      "description": "one sentence",
      "active": true,
      "weight": 0.25,
      "proficiency_levels": [
        {"level": 1, "label": "Basic", "descriptor": "..."},
        {"level": 2, "label": "Developing", "descriptor": "..."},
        {"level": 3, "label": "Proficient", "descriptor": "..."},
        {"level": 4, "label": "Mastery", "descriptor": "..."}
      ]
    }
  ]
}`,
    }],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  let dims: RubricDimension[]
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as { dimensions: RubricDimension[] }
    dims = parsed.dimensions
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    dims = m ? (JSON.parse(m[0]) as { dimensions: RubricDimension[] }).dimensions : []
  }

  return createRubricVersion(courseId, 'agent_generated', dims, { agent_rationale: `Generated from course sources: ${sourceIds.join(', ')}` })
}

// ── 5. parse_uploaded_rubric ──────────────────────────────────────────────────

export async function parse_uploaded_rubric(courseId: string, rubricText: string): Promise<RubricVersion> {
  const response = await createChatCompletion({
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Parse this instructor-uploaded rubric into structured JSON.

Rubric content:
${rubricText.slice(0, 4000)}

Extract dimensions with proficiency levels. Infer weights so they sum to 1.0.

Return ONLY valid JSON:
{
  "dimensions": [
    {
      "id": "snake_case_id",
      "name": "Dimension Name",
      "description": "one sentence",
      "active": true,
      "weight": 0.25,
      "proficiency_levels": [
        {"level": 1, "label": "Basic", "descriptor": "..."},
        {"level": 2, "label": "Developing", "descriptor": "..."},
        {"level": 3, "label": "Proficient", "descriptor": "..."},
        {"level": 4, "label": "Mastery", "descriptor": "..."}
      ]
    }
  ],
  "parse_confidence": "high|medium|low",
  "notes": "any parsing ambiguities"
}`,
    }],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  let dims: RubricDimension[]
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as { dimensions: RubricDimension[]; parse_confidence: string }
    dims = parsed.dimensions
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    dims = m ? (JSON.parse(m[0]) as { dimensions: RubricDimension[] }).dimensions : []
  }

  return createRubricVersion(courseId, 'uploaded', dims, {})
}

// ── 6. update_calibration_profile ─────────────────────────────────────────────

export async function update_calibration_profile(
  courseId: string,
  field: string,
  value: unknown,
  rationale: string,
  actor: 'agent' | 'instructor'
): Promise<CalibrationVersion> {
  let calibration = getActiveCalibration(courseId)

  if (!calibration) {
    const rubric = getActiveRubric(courseId)
    if (!rubric) throw new Error('No active rubric found for this course. Create or select a rubric first.')
    calibration = createCalibrationVersion(courseId, rubric.id, {})
  }

  // Map field name to DB column
  const fieldMap: Record<string, string> = {
    depthBreadth: 'depth_breadth',
    seedQuestions: 'seed_questions_json',
    inferredTypes: 'inferred_types_json',
    emphasisConcepts: 'emphasis_json',
    deEmphasisConcepts: 'de_emphasis_json',
    tonePreferences: 'tone_json',
  }

  const dbField = fieldMap[field]
  if (!dbField) throw new Error(`Unknown calibration field: ${field}`)

  const valueJson = dbField === 'depth_breadth' ? String(value) : JSON.stringify(value)
  updateCalibrationField(calibration.id, dbField, valueJson)

  // Append to reasoning log
  const entry: ReasoningLogEntry = {
    field,
    decision: JSON.stringify(value),
    rationale,
    timestamp: new Date().toISOString(),
    source: actor === 'agent' ? 'agent_inferred' : 'instructor_answered',
  }
  const currentLog = calibration.reasoningLog
  updateCalibrationField(calibration.id, 'reasoning_log_json', JSON.stringify([...currentLog, entry]))

  const updated = getCalibrationVersion(calibration.id)!
  return updated
}

// ── 7. publish_calibration_version ────────────────────────────────────────────

export function publish_calibration_version(courseId: string): string {
  const calibration = getActiveCalibration(courseId)
  if (!calibration) throw new Error('No active calibration to publish.')

  const rubric = getActiveRubric(courseId)
  if (!rubric) throw new Error('No active rubric to publish.')

  // Create a new version (this is already what update_calibration_profile does;
  // "publish" freezes the draft by creating a new sealed version)
  const published = createCalibrationVersion(courseId, rubric.id, {
    createdBy: 'instructor',
    depthBreadth: calibration.depthBreadth,
    seedQuestions: calibration.seedQuestions,
    inferredTypes: calibration.inferredTypes,
    emphasisConcepts: calibration.emphasisConcepts,
    deEmphasisConcepts: calibration.deEmphasisConcepts,
    tonePreferences: calibration.tonePreferences,
    reasoningLog: calibration.reasoningLog,
  })

  return published.id
}

// ── 8. request_instructor_input ────────────────────────────────────────────────

export async function request_instructor_input(
  courseId: string,
  field: string,
  widgetType: WidgetType,
  widgetConfig: Record<string, unknown>
): Promise<InputRequestId> {
  const state = getOrCreateAgentState(courseId)

  if (!state.draftComplete) {
    throw new Error('Agent must complete a draft CalibrationProfile before asking the instructor any questions. Set draftComplete=true first.')
  }

  if (state.questionsAsked >= QUESTION_BUDGET) {
    throw new Error(`Question budget exhausted. The agent may ask at most ${QUESTION_BUDGET} questions per calibration session.`)
  }

  const requestId = newId()
  updateAgentState(courseId, { questionsAsked: state.questionsAsked + 1 })

  // The request payload is stored in Redis temporarily so the frontend can poll/receive it
  const redis = new (await import('@upstash/redis')).Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  const payload: InputRequest = { request_id: requestId, course_id: courseId, field, widget_type: widgetType, widget_config: widgetConfig }
  await redis.set(`widget_request:${courseId}:${requestId}`, JSON.stringify(payload), { ex: 3600 })

  return requestId
}

// ── mark_draft_complete (agent lifecycle helper) ───────────────────────────────

export function mark_draft_complete(courseId: string): void {
  getOrCreateAgentState(courseId)
  updateAgentState(courseId, { draftComplete: true })
}

// ── get_agent_state (introspection) ───────────────────────────────────────────

export function get_agent_state(courseId: string) {
  return getOrCreateAgentState(courseId)
}
