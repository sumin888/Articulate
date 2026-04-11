import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/session/[id]/feedback/route'
import { getSession, updateSession } from '@/lib/session-store'
import { generateFeedback } from '@/lib/feedback-generator'

vi.mock('@/lib/session-store', () => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/feedback-generator', () => ({
  generateFeedback: vi.fn(),
}))

const session = {
  id: 's1',
  sourceMaterial: 'm',
  sourceTitle: 'Title',
  concepts: [
    { name: 'a', definition: 'd', relationships: [] },
    { name: 'b', definition: 'd', relationships: [] },
    { name: 'c', definition: 'd', relationships: [] },
    { name: 'd', definition: 'd', relationships: [] },
    { name: 'e', definition: 'd', relationships: [] },
  ],
  phase: 'interpretation' as const,
  turnsInPhase: 1,
  conversationHistory: [] as { role: 'articulate' | 'student'; content: string }[],
  createdAt: 1,
}

describe('GET /api/session/[id]/feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when session missing', async () => {
    vi.mocked(getSession).mockResolvedValue(undefined)
    const res = await GET(new NextRequest('http://localhost/api/session/x/feedback'), {
      params: Promise.resolve({ id: 'x' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns history and phase', async () => {
    vi.mocked(getSession).mockResolvedValue(session)
    const res = await GET(new NextRequest('http://localhost/api/session/s1/feedback'), {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sourceTitle).toBe('Title')
    expect(body.phase).toBe('interpretation')
  })
})

describe('POST /api/session/[id]/feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cached feedback without calling generator', async () => {
    vi.mocked(getSession).mockResolvedValue({
      ...session,
      feedback: {
        strength: 's',
        areaToDevelop: 'a',
        recommendedNextStep: 'n',
      },
    })
    const res = await POST(new NextRequest('http://localhost/api/session/s1/feedback'), {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.feedback.strength).toBe('s')
    expect(generateFeedback).not.toHaveBeenCalled()
  })

  it('generates feedback when missing', async () => {
    vi.mocked(getSession).mockResolvedValue(session)
    vi.mocked(generateFeedback).mockResolvedValue({
      strength: 'Good.',
      areaToDevelop: 'Gap.',
      recommendedNextStep: 'Practice.',
    })
    vi.mocked(updateSession).mockResolvedValue(session)

    const res = await POST(new NextRequest('http://localhost/api/session/s1/feedback'), {
      params: Promise.resolve({ id: 's1' }),
    })
    expect(res.status).toBe(200)
    expect(generateFeedback).toHaveBeenCalled()
    expect(updateSession).toHaveBeenCalled()
  })
})
