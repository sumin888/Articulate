import { Redis } from '@upstash/redis'

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

const SESSION_TTL_SECONDS = 60 * 60 * 24 // 24 hours

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

function sessionKey(id: string) {
  return `session:${id}`
}

export async function createSession(
  sourceMaterial: string,
  sourceTitle: string,
  concepts: Concept[]
): Promise<SessionState> {
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
  await getRedis().set(sessionKey(id), JSON.stringify(session), { ex: SESSION_TTL_SECONDS })
  return session
}

export async function getSession(id: string): Promise<SessionState | undefined> {
  const data = await getRedis().get<string>(sessionKey(id))
  if (!data) return undefined
  return (typeof data === 'string' ? JSON.parse(data) : data) as SessionState
}

export async function updateSession(
  id: string,
  updates: Partial<SessionState>
): Promise<SessionState | undefined> {
  const session = await getSession(id)
  if (!session) return undefined
  const updated = { ...session, ...updates }
  await getRedis().set(sessionKey(id), JSON.stringify(updated), { ex: SESSION_TTL_SECONDS })
  return updated
}
