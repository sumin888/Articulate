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

// In-memory store — sufficient for MVP
const sessions = new Map<string, SessionState>()

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
