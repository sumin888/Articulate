import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') ?? path.join(process.cwd(), 'dev.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  migrate(_db)
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      redis_key TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding_json TEXT,
      page_number INTEGER,
      slide_number INTEGER,
      paragraph_index INTEGER,
      bbox_json TEXT
    );

    CREATE TABLE IF NOT EXISTS source_concepts (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      chunk_ids TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS rubric_versions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      is_active INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      template_id TEXT,
      dimensions_json TEXT NOT NULL DEFAULT '[]',
      origin_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS calibration_versions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      rubric_version_id TEXT NOT NULL REFERENCES rubric_versions(id),
      is_active INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT 'instructor',
      depth_breadth REAL NOT NULL DEFAULT 0.5,
      seed_questions_json TEXT NOT NULL DEFAULT '[]',
      inferred_types_json TEXT NOT NULL DEFAULT '[]',
      emphasis_json TEXT NOT NULL DEFAULT '[]',
      de_emphasis_json TEXT NOT NULL DEFAULT '[]',
      tone_json TEXT NOT NULL DEFAULT '{"formality":"professional","scaffolding_level":"moderate"}',
      reasoning_log_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS agent_states (
      course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
      questions_asked INTEGER NOT NULL DEFAULT 0,
      draft_complete INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)
}

// ── ID generation ──────────────────────────────────────────────────────────────

export function newId(): string {
  return crypto.randomUUID()
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type RubricDimension = {
  id: string
  name: string
  description: string
  active: boolean
  weight: number
  proficiency_levels: { level: number; label: string; descriptor: string }[]
}

export type RubricOrigin = {
  uploaded_file_id?: string
  agent_rationale?: string
  template_id?: string
}

export type SeedQuestion = {
  id: string
  text: string
  type: string
  dimension_targeted: string
  instructor_approved: boolean
}

export type InferredQuestionType = {
  type: string
  weight: number
  exemplars: string[]
}

export type TonePreferences = {
  formality: 'casual' | 'professional' | 'academic'
  scaffolding_level: 'minimal' | 'moderate' | 'high'
}

export type ReasoningLogEntry = {
  field: string
  decision: string
  rationale: string
  timestamp: string
  source: 'agent_inferred' | 'instructor_answered'
  source_citations?: string[]
}

export type Course = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type Source = {
  id: string
  courseId: string
  filename: string
  fileType: 'pdf' | 'docx' | 'pptx'
  redisKey: string
  createdAt: number
}

export type Chunk = {
  id: string
  sourceId: string
  chunkIndex: number
  text: string
  embeddingJson: string | null
  pageNumber: number | null
  slideNumber: number | null
  paragraphIndex: number | null
  bboxJson: string | null
}

export type SourceConcept = {
  id: string
  sourceId: string
  label: string
  chunkIds: string[]
}

export type RubricVersion = {
  id: string
  courseId: string
  isActive: boolean
  source: 'uploaded' | 'agent_generated' | 'template'
  templateId: string | null
  dimensions: RubricDimension[]
  origin: RubricOrigin
  createdAt: number
}

export type CalibrationVersion = {
  id: string
  courseId: string
  rubricVersionId: string
  isActive: boolean
  createdBy: string
  depthBreadth: number
  seedQuestions: SeedQuestion[]
  inferredTypes: InferredQuestionType[]
  emphasisConcepts: string[]
  deEmphasisConcepts: string[]
  tonePreferences: TonePreferences
  reasoningLog: ReasoningLogEntry[]
  createdAt: number
}

export type AgentState = {
  courseId: string
  questionsAsked: number
  draftComplete: boolean
  updatedAt: number
}

// ── Courses ────────────────────────────────────────────────────────────────────

export function createCourse(name: string): Course {
  const db = getDb()
  const id = newId()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('INSERT INTO courses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name, now, now)
  return { id, name, createdAt: now, updatedAt: now }
}

export function getCourse(id: string): Course | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return { id: row.id as string, name: row.name as string, createdAt: row.created_at as number, updatedAt: row.updated_at as number }
}

export function listCourses(): Course[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM courses ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(r => ({ id: r.id as string, name: r.name as string, createdAt: r.created_at as number, updatedAt: r.updated_at as number }))
}

// ── Sources ────────────────────────────────────────────────────────────────────

export function createSource(courseId: string, filename: string, fileType: string, redisKey: string): Source {
  const db = getDb()
  const id = newId()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('INSERT INTO sources (id, course_id, filename, file_type, redis_key, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, courseId, filename, fileType, redisKey, now)
  return { id, courseId, filename, fileType: fileType as Source['fileType'], redisKey, createdAt: now }
}

export function getSource(id: string): Source | null {
  const db = getDb()
  const r = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!r) return null
  return { id: r.id as string, courseId: r.course_id as string, filename: r.filename as string, fileType: r.file_type as Source['fileType'], redisKey: r.redis_key as string, createdAt: r.created_at as number }
}

export function listSources(courseId: string): Source[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM sources WHERE course_id = ? ORDER BY created_at ASC').all(courseId) as Record<string, unknown>[]
  return rows.map(r => ({ id: r.id as string, courseId: r.course_id as string, filename: r.filename as string, fileType: r.file_type as Source['fileType'], redisKey: r.redis_key as string, createdAt: r.created_at as number }))
}

// ── Chunks ─────────────────────────────────────────────────────────────────────

export function insertChunk(chunk: Omit<Chunk, 'id'>): Chunk {
  const db = getDb()
  const id = newId()
  db.prepare(`
    INSERT INTO chunks (id, source_id, chunk_index, text, embedding_json, page_number, slide_number, paragraph_index, bbox_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, chunk.sourceId, chunk.chunkIndex, chunk.text, chunk.embeddingJson ?? null, chunk.pageNumber ?? null, chunk.slideNumber ?? null, chunk.paragraphIndex ?? null, chunk.bboxJson ?? null)
  return { ...chunk, id }
}

export function updateChunkEmbedding(chunkId: string, embeddingJson: string) {
  getDb().prepare('UPDATE chunks SET embedding_json = ? WHERE id = ?').run(embeddingJson, chunkId)
}

export function listChunks(sourceId: string): Chunk[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM chunks WHERE source_id = ? ORDER BY chunk_index ASC').all(sourceId) as Record<string, unknown>[]
  return rows.map(rowToChunk)
}

export function listCourseChunks(courseId: string): Chunk[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT c.* FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE s.course_id = ?
    ORDER BY c.source_id, c.chunk_index
  `).all(courseId) as Record<string, unknown>[]
  return rows.map(rowToChunk)
}

export function getChunkById(id: string): Chunk | null {
  const db = getDb()
  const r = db.prepare('SELECT * FROM chunks WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!r) return null
  return rowToChunk(r)
}

function rowToChunk(r: Record<string, unknown>): Chunk {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    chunkIndex: r.chunk_index as number,
    text: r.text as string,
    embeddingJson: r.embedding_json as string | null,
    pageNumber: r.page_number as number | null,
    slideNumber: r.slide_number as number | null,
    paragraphIndex: r.paragraph_index as number | null,
    bboxJson: r.bbox_json as string | null,
  }
}

// ── SourceConcepts ─────────────────────────────────────────────────────────────

export function insertSourceConcept(sourceId: string, label: string, chunkIds: string[]): SourceConcept {
  const db = getDb()
  const id = newId()
  db.prepare('INSERT INTO source_concepts (id, source_id, label, chunk_ids) VALUES (?, ?, ?, ?)').run(id, sourceId, label, JSON.stringify(chunkIds))
  return { id, sourceId, label, chunkIds }
}

export function listSourceConcepts(sourceId: string): SourceConcept[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM source_concepts WHERE source_id = ?').all(sourceId) as Record<string, unknown>[]
  return rows.map(r => ({ id: r.id as string, sourceId: r.source_id as string, label: r.label as string, chunkIds: JSON.parse(r.chunk_ids as string) as string[] }))
}

export function listCourseConcepts(courseId: string): SourceConcept[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT sc.* FROM source_concepts sc
    JOIN sources s ON sc.source_id = s.id
    WHERE s.course_id = ?
  `).all(courseId) as Record<string, unknown>[]
  return rows.map(r => ({ id: r.id as string, sourceId: r.source_id as string, label: r.label as string, chunkIds: JSON.parse(r.chunk_ids as string) as string[] }))
}

// ── RubricVersions ─────────────────────────────────────────────────────────────

export function createRubricVersion(courseId: string, source: RubricVersion['source'], dimensions: RubricDimension[], origin: RubricOrigin, templateId?: string): RubricVersion {
  const db = getDb()
  const id = newId()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('UPDATE rubric_versions SET is_active = 0 WHERE course_id = ?').run(courseId)
  db.prepare(`
    INSERT INTO rubric_versions (id, course_id, is_active, source, template_id, dimensions_json, origin_json, created_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?)
  `).run(id, courseId, source, templateId ?? null, JSON.stringify(dimensions), JSON.stringify(origin), now)
  return { id, courseId, isActive: true, source, templateId: templateId ?? null, dimensions, origin, createdAt: now }
}

export function getActiveRubric(courseId: string): RubricVersion | null {
  const db = getDb()
  const r = db.prepare('SELECT * FROM rubric_versions WHERE course_id = ? AND is_active = 1').get(courseId) as Record<string, unknown> | undefined
  if (!r) return null
  return rowToRubric(r)
}

export function listRubricVersions(courseId: string): RubricVersion[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM rubric_versions WHERE course_id = ? ORDER BY created_at DESC').all(courseId) as Record<string, unknown>[]
  return rows.map(rowToRubric)
}

export function getRubricVersion(id: string): RubricVersion | null {
  const db = getDb()
  const r = db.prepare('SELECT * FROM rubric_versions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!r) return null
  return rowToRubric(r)
}

function rowToRubric(r: Record<string, unknown>): RubricVersion {
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    isActive: Boolean(r.is_active),
    source: r.source as RubricVersion['source'],
    templateId: r.template_id as string | null,
    dimensions: JSON.parse(r.dimensions_json as string) as RubricDimension[],
    origin: JSON.parse(r.origin_json as string) as RubricOrigin,
    createdAt: r.created_at as number,
  }
}

// ── CalibrationVersions ────────────────────────────────────────────────────────

export function createCalibrationVersion(courseId: string, rubricVersionId: string, data: Partial<Omit<CalibrationVersion, 'id' | 'courseId' | 'rubricVersionId' | 'isActive' | 'createdAt'>>): CalibrationVersion {
  const db = getDb()
  const id = newId()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('UPDATE calibration_versions SET is_active = 0 WHERE course_id = ?').run(courseId)
  const row = {
    id,
    courseId,
    rubricVersionId,
    isActive: true,
    createdBy: data.createdBy ?? 'instructor',
    depthBreadth: data.depthBreadth ?? 0.5,
    seedQuestions: data.seedQuestions ?? [],
    inferredTypes: data.inferredTypes ?? [],
    emphasisConcepts: data.emphasisConcepts ?? [],
    deEmphasisConcepts: data.deEmphasisConcepts ?? [],
    tonePreferences: data.tonePreferences ?? { formality: 'professional' as const, scaffolding_level: 'moderate' as const },
    reasoningLog: data.reasoningLog ?? [],
    createdAt: now,
  }
  db.prepare(`
    INSERT INTO calibration_versions
      (id, course_id, rubric_version_id, is_active, created_by, depth_breadth,
       seed_questions_json, inferred_types_json, emphasis_json, de_emphasis_json,
       tone_json, reasoning_log_json, created_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, courseId, rubricVersionId, row.createdBy, row.depthBreadth,
    JSON.stringify(row.seedQuestions), JSON.stringify(row.inferredTypes),
    JSON.stringify(row.emphasisConcepts), JSON.stringify(row.deEmphasisConcepts),
    JSON.stringify(row.tonePreferences), JSON.stringify(row.reasoningLog), now)
  return row
}

export function getActiveCalibration(courseId: string): CalibrationVersion | null {
  const db = getDb()
  const r = db.prepare('SELECT * FROM calibration_versions WHERE course_id = ? AND is_active = 1').get(courseId) as Record<string, unknown> | undefined
  if (!r) return null
  return rowToCalibration(r)
}

export function getCalibrationVersion(id: string): CalibrationVersion | null {
  const db = getDb()
  const r = db.prepare('SELECT * FROM calibration_versions WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!r) return null
  return rowToCalibration(r)
}

export function listCalibrationVersions(courseId: string): CalibrationVersion[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM calibration_versions WHERE course_id = ? ORDER BY created_at DESC').all(courseId) as Record<string, unknown>[]
  return rows.map(rowToCalibration)
}

export function updateCalibrationField(calibrationId: string, field: string, valueJson: string) {
  const allowed = new Set(['depth_breadth', 'seed_questions_json', 'inferred_types_json', 'emphasis_json', 'de_emphasis_json', 'tone_json', 'reasoning_log_json'])
  if (!allowed.has(field)) throw new Error(`Field not updatable: ${field}`)
  getDb().prepare(`UPDATE calibration_versions SET ${field} = ? WHERE id = ?`).run(valueJson, calibrationId)
}

function rowToCalibration(r: Record<string, unknown>): CalibrationVersion {
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    rubricVersionId: r.rubric_version_id as string,
    isActive: Boolean(r.is_active),
    createdBy: r.created_by as string,
    depthBreadth: r.depth_breadth as number,
    seedQuestions: JSON.parse(r.seed_questions_json as string) as SeedQuestion[],
    inferredTypes: JSON.parse(r.inferred_types_json as string) as InferredQuestionType[],
    emphasisConcepts: JSON.parse(r.emphasis_json as string) as string[],
    deEmphasisConcepts: JSON.parse(r.de_emphasis_json as string) as string[],
    tonePreferences: JSON.parse(r.tone_json as string) as TonePreferences,
    reasoningLog: JSON.parse(r.reasoning_log_json as string) as ReasoningLogEntry[],
    createdAt: r.created_at as number,
  }
}

// ── AgentState ─────────────────────────────────────────────────────────────────

export function getOrCreateAgentState(courseId: string): AgentState {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare('INSERT OR IGNORE INTO agent_states (course_id, updated_at) VALUES (?, ?)').run(courseId, now)
  const r = db.prepare('SELECT * FROM agent_states WHERE course_id = ?').get(courseId) as Record<string, unknown>
  return { courseId: r.course_id as string, questionsAsked: r.questions_asked as number, draftComplete: Boolean(r.draft_complete), updatedAt: r.updated_at as number }
}

export function updateAgentState(courseId: string, updates: Partial<Pick<AgentState, 'questionsAsked' | 'draftComplete'>>) {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  if (updates.questionsAsked !== undefined) db.prepare('UPDATE agent_states SET questions_asked = ?, updated_at = ? WHERE course_id = ?').run(updates.questionsAsked, now, courseId)
  if (updates.draftComplete !== undefined) db.prepare('UPDATE agent_states SET draft_complete = ?, updated_at = ? WHERE course_id = ?').run(updates.draftComplete ? 1 : 0, now, courseId)
}
