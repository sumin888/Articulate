import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/session/[id]/message/route'
import { getSession, updateSession } from '@/lib/session-store'
import { processStudentResponse } from '@/lib/session-engine'

vi.mock('@/lib/session-store', () => ({
  getSession: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/session-engine', () => ({
  processStudentResponse: vi.fn(),
}))

const baseSession = {
  id: 'sess-1',
  sourceMaterial: 'notes',
  sourceTitle: 'T',
  concepts: [
    { name: 'c1', definition: 'd', relationships: [] },
    { name: 'c2', definition: 'd', relationships: [] },
    { name: 'c3', definition: 'd', relationships: [] },
    { name: 'c4', definition: 'd', relationships: [] },
    { name: 'c5', definition: 'd', relationships: [] },
  ],
  phase: 'recognition' as const,
  turnsInPhase: 0,
  conversationHistory: [] as { role: 'articulate' | 'student'; content: string }[],
  createdAt: Date.now(),
}

describe('POST /api/session/[id]/message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when message is missing or blank', async () => {
    const req = new NextRequest('http://localhost/api/session/sess-1/message', {
      method: 'POST',
      body: JSON.stringify({ message: '   ' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/i)
  })

  it('returns 404 when session not found', async () => {
    vi.mocked(getSession).mockResolvedValue(undefined)
    const req = new NextRequest('http://localhost/api/session/missing/message', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when session already complete', async () => {
    vi.mocked(getSession).mockResolvedValue({ ...baseSession, phase: 'complete' })
    const req = new NextRequest('http://localhost/api/session/sess-1/message', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns model reply and updates session', async () => {
    const withStudent = {
      ...baseSession,
      conversationHistory: [{ role: 'articulate' as const, content: 'Hi' }],
    }
    vi.mocked(getSession)
      .mockResolvedValueOnce(withStudent)
      .mockResolvedValueOnce({
        ...withStudent,
        conversationHistory: [...withStudent.conversationHistory, { role: 'student' as const, content: 'Answer' }],
      })
    vi.mocked(updateSession).mockResolvedValue(withStudent)
    vi.mocked(processStudentResponse).mockResolvedValue({
      message: 'Good work.',
      requestsWrittenInput: false,
      writtenInputPrompt: undefined,
      phaseAdvanced: false,
      newPhase: 'recognition',
      sessionComplete: false,
    })

    const req = new NextRequest('http://localhost/api/session/sess-1/message', {
      method: 'POST',
      body: JSON.stringify({ message: 'Answer' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'sess-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Good work.')
    expect(processStudentResponse).toHaveBeenCalled()
    expect(updateSession).toHaveBeenCalled()
  })
})
