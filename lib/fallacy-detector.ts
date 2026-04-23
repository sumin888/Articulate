import { createChatCompletion } from './chat-completion'
import { Redis } from '@upstash/redis'

export type FallacyEvent = {
  turnNumber: number
  fallacy: string | null
  excerpt: string
  explanation: string
  detectedAt: number
}

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

function fallacyKey(sessionId: string, turnNumber: number) {
  return `fallacy:${sessionId}:${turnNumber}`
}

/**
 * Fire-and-forget: detect fallacies in a student message async.
 * Does NOT block the caller — errors are logged only.
 */
export function detectFallacyFireAndForget(
  sessionId: string,
  turnNumber: number,
  studentMessage: string
): void {
  runDetection(sessionId, turnNumber, studentMessage).catch(err => {
    console.error('[fallacy] detection error:', err)
  })
}

async function runDetection(
  sessionId: string,
  turnNumber: number,
  studentMessage: string
): Promise<void> {
  if (!studentMessage.trim() || studentMessage.trim().split(/\s+/).length < 10) {
    // Too short to meaningfully analyze
    return
  }

  const response = await createChatCompletion({
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `You are a logic and argumentation expert. Analyze the following student statement for reasoning fallacies or conceptual errors. Reply with ONLY valid JSON, no other text.

Student statement: "${studentMessage.slice(0, 800)}"

Return:
{"fallacy": "name of fallacy or null if none", "excerpt": "short quote from statement (or empty string)", "explanation": "one-sentence explanation or empty string if no fallacy"}

If there is no significant fallacy, set fallacy to null and leave the other fields empty.`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  if (!raw.trim()) return

  let parsed: { fallacy: string | null; excerpt: string; explanation: string }
  try {
    parsed = JSON.parse(raw.trim())
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return
    try {
      parsed = JSON.parse(m[0])
    } catch {
      return
    }
  }

  if (!parsed.fallacy) return

  const event: FallacyEvent = {
    turnNumber,
    fallacy: parsed.fallacy,
    excerpt: parsed.excerpt ?? '',
    explanation: parsed.explanation ?? '',
    detectedAt: Date.now(),
  }

  await getRedis().set(fallacyKey(sessionId, turnNumber), JSON.stringify(event), {
    ex: 60 * 60 * 24,
  })
}

export async function getFallacies(sessionId: string): Promise<FallacyEvent[]> {
  const redis = getRedis()
  // Scan for all fallacy keys for this session
  const keys: string[] = []
  const pattern = `fallacy:${sessionId}:*`

  let cursor: string | number = '0'
  do {
    const [nextCursor, batch]: [string, string[]] = await redis.scan(cursor, { match: pattern, count: 100 })
    cursor = nextCursor
    keys.push(...batch)
  } while (cursor !== '0')

  if (!keys.length) return []

  const values = await Promise.all(keys.map(k => redis.get<string>(k)))

  return values
    .map(v => {
      if (!v) return null
      try {
        return (typeof v === 'string' ? JSON.parse(v) : v) as FallacyEvent
      } catch {
        return null
      }
    })
    .filter((e): e is FallacyEvent => e !== null)
    .sort((a, b) => a.turnNumber - b.turnNumber)
}
