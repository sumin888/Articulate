import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/upload/route'
import { bootstrapSessionFromMaterial } from '@/lib/content-analyzer'
import { createSession, updateSession } from '@/lib/session-store'

vi.mock('@/lib/content-analyzer', () => ({
  bootstrapSessionFromMaterial: vi.fn(),
}))

vi.mock('@/lib/session-store', () => ({
  createSession: vi.fn(),
  updateSession: vi.fn(),
}))

function formUrlEncodedRequest(body: URLSearchParams) {
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when no file or text', async () => {
    const req = formUrlEncodedRequest(new URLSearchParams())
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when pasted text too short', async () => {
    const params = new URLSearchParams()
    params.set('text', 'short')
    const res = await POST(formUrlEncodedRequest(params))
    expect(res.status).toBe(400)
  })

  it('creates session and returns sessionId for pasted text', async () => {
    vi.mocked(bootstrapSessionFromMaterial).mockResolvedValue({
      concepts: [
        { name: 'a', definition: 'd', relationships: [] },
        { name: 'b', definition: 'd', relationships: [] },
        { name: 'c', definition: 'd', relationships: [] },
        { name: 'd', definition: 'd', relationships: [] },
        { name: 'e', definition: 'd', relationships: [] },
      ],
      openingMessage: 'Hello\n\nQ?',
    })
    vi.mocked(createSession).mockImplementation(async (source, title, concepts) => ({
      id: 'new-id',
      sourceMaterial: source,
      sourceTitle: title,
      concepts,
      phase: 'recognition',
      turnsInPhase: 0,
      conversationHistory: [],
      createdAt: 1,
    }))
    vi.mocked(updateSession).mockResolvedValue(undefined)

    const params = new URLSearchParams()
    params.set('text', 'x'.repeat(120))
    const res = await POST(formUrlEncodedRequest(params))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessionId).toBe('new-id')
    expect(bootstrapSessionFromMaterial).toHaveBeenCalled()
    expect(updateSession).toHaveBeenCalled()
  })
})
