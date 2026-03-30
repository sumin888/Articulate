export type Phase = 'recognition' | 'retrieval' | 'interpretation' | 'complete'

export type Message = {
  role: 'articulate' | 'student'
  content: string
  isWrittenInput?: boolean
}

export type Concept = {
  name: string
  definition: string
  relationships: string[]
}

export type Feedback = {
  strength: string
  areaToDevelop: string
  recommendedNextStep: string
}

export type SessionState = {
  id: string
  sourceMaterial: string
  sourceTitle: string
  concepts: Concept[]
  phase: Phase
  turnsInPhase: number
  conversationHistory: Message[]
  feedback?: Feedback
  createdAt: number
}

// In-memory store — sufficient for MVP.
// Use globalThis so upload + session API routes share one Map (Turbopack can otherwise
// instantiate this module separately per route chunk, which caused "Session not found").
const g = globalThis as unknown as { __articulateSessionStore?: Map<string, SessionState> }
const sessions = g.__articulateSessionStore ?? new Map<string, SessionState>()
g.__articulateSessionStore = sessions

export function createSession(
  sourceMaterial: string,
  sourceTitle: string,
  concepts: Concept[]
): SessionState {
  const id = crypto.randomUUID()
  const session: SessionState = {
    id,
    sourceMaterial,
    sourceTitle,
    concepts,
    phase: 'recognition',
    turnsInPhase: 0,
    conversationHistory: [],
    createdAt: Date.now(),
  }
  sessions.set(id, session)
  return session
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id)
}

export function updateSession(id: string, updates: Partial<SessionState>): SessionState | undefined {
  const session = sessions.get(id)
  if (!session) return undefined
  const updated = { ...session, ...updates }
  sessions.set(id, updated)
  return updated
}
