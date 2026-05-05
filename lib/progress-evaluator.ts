import { createChatCompletion } from './chat-completion'
import { getCalibrationVersion, getRubricVersion, listCourseConcepts } from './db'
import type { RubricDimension } from './db'

export type DimensionScore = {
  dimensionId: string
  dimensionName: string
  score: number  // 1–4 (rubric proficiency levels)
  weight: number
}

export type ProgressState = {
  touchedConceptIds: string[]   // concept IDs encountered in this session
  totalConceptCount: number
  dimensionScores: DimensionScore[]
  weakestDimensionId: string | null
  updatedAt: number
}

export function emptyProgress(totalConceptCount: number): ProgressState {
  return {
    touchedConceptIds: [],
    totalConceptCount,
    dimensionScores: [],
    weakestDimensionId: null,
    updatedAt: Date.now(),
  }
}

// Track which concepts were surfaced in retrieval for this turn
export function updateTouchedConcepts(
  progress: ProgressState,
  retrievedChunkIds: string[],
  allConcepts: { id: string; chunkIds: string[] }[]
): ProgressState {
  const touched = new Set(progress.touchedConceptIds)
  for (const concept of allConcepts) {
    if (concept.chunkIds.some(cid => retrievedChunkIds.includes(cid))) {
      touched.add(concept.id)
    }
  }
  return { ...progress, touchedConceptIds: Array.from(touched), updatedAt: Date.now() }
}

// Run async rubric evaluator against the last exchange
export async function evaluateRubricDimensions(
  studentMessage: string,
  assistantMessage: string,
  calibrationVersionId: string
): Promise<DimensionScore[]> {
  const calibration = getCalibrationVersion(calibrationVersionId)
  if (!calibration) return []

  const rubric = getRubricVersion(calibration.rubricVersionId)
  if (!rubric) return []

  const activeDimensions = rubric.dimensions.filter((d: RubricDimension) => d.active)
  if (activeDimensions.length === 0) return []

  const dimensionList = activeDimensions.map((d: RubricDimension) =>
    `- ${d.id} (${d.name}): ${d.description}\n  Levels: ${d.proficiency_levels.map(l => `${l.level}=${l.label}`).join(', ')}`
  ).join('\n')

  const response = await createChatCompletion({
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Evaluate this student's oral communication turn against rubric dimensions.

Student said: "${studentMessage.slice(0, 500)}"
Examiner said: "${assistantMessage.slice(0, 300)}"

Active rubric dimensions:
${dimensionList}

Score each active dimension 1–4 based on the student's response. Only score dimensions where evidence is present.

Return ONLY valid JSON:
{"scores": [{"dimension_id": "organization", "score": 3}, ...]}`,
    }],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  let scores: { dimension_id: string; score: number }[]
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as { scores: typeof scores }
    scores = parsed.scores ?? []
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    scores = m ? ((JSON.parse(m[0]) as { scores: typeof scores }).scores ?? []) : []
  }

  return scores
    .filter(s => s.score >= 1 && s.score <= 4)
    .map(s => {
      const dim = activeDimensions.find((d: RubricDimension) => d.id === s.dimension_id)
      return dim ? { dimensionId: dim.id, dimensionName: dim.name, score: s.score, weight: dim.weight } : null
    })
    .filter((d): d is DimensionScore => d !== null)
}

export function computeWeakestDimension(dimensionScores: DimensionScore[]): string | null {
  if (dimensionScores.length === 0) return null
  return dimensionScores.reduce((weakest, d) =>
    d.score < weakest.score ? d : weakest
  ).dimensionId
}

// Merge new dimension scores into accumulated progress (weighted average by recency)
export function mergeDimensionScores(existing: DimensionScore[], incoming: DimensionScore[]): DimensionScore[] {
  const map = new Map<string, DimensionScore>()
  for (const d of existing) map.set(d.dimensionId, d)
  for (const d of incoming) {
    const prev = map.get(d.dimensionId)
    if (prev) {
      // Simple moving average: 30% new, 70% historical
      map.set(d.dimensionId, { ...d, score: 0.7 * prev.score + 0.3 * d.score })
    } else {
      map.set(d.dimensionId, d)
    }
  }
  return Array.from(map.values())
}

// Fire-and-forget version for use in API route
export function evaluateProgressFireAndForget(
  sessionId: string,
  studentMessage: string,
  assistantMessage: string,
  calibrationVersionId: string,
  retrievedChunkIds: string[],
  courseId: string,
  updateSessionProgress: (progress: ProgressState) => Promise<void>,
  currentProgress: ProgressState
): void {
  const run = async () => {
    try {
      const allConcepts = listCourseConcepts(courseId).map(c => ({ id: c.id, chunkIds: c.chunkIds }))
      const newScores = await evaluateRubricDimensions(studentMessage, assistantMessage, calibrationVersionId)
      const merged = mergeDimensionScores(currentProgress.dimensionScores, newScores)
      const updated: ProgressState = {
        ...updateTouchedConcepts(currentProgress, retrievedChunkIds, allConcepts),
        dimensionScores: merged,
        weakestDimensionId: computeWeakestDimension(merged),
        updatedAt: Date.now(),
      }
      await updateSessionProgress(updated)
    } catch {
      // Non-fatal: progress update failure doesn't break the session
    }
  }
  run()
}
