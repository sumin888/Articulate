import { describe, expect, it, vi } from 'vitest'

vi.mock('./chat-completion', () => ({
  createChatCompletion: vi.fn(),
}))

import { parseEngineResponse } from './session-engine'

describe('parseEngineResponse', () => {
  it('strips PHASE_COMPLETE and advances phase from recognition', () => {
    const r = parseEngineResponse('Hello\nPHASE_COMPLETE\n', 'recognition')
    expect(r.message).toBe('Hello')
    expect(r.phaseAdvanced).toBe(true)
    expect(r.newPhase).toBe('retrieval')
    expect(r.sessionComplete).toBe(false)
    expect(r.requestsWrittenInput).toBe(false)
  })

  it('sets complete when SESSION_COMPLETE', () => {
    const r = parseEngineResponse('Done.\nSESSION_COMPLETE', 'interpretation')
    expect(r.sessionComplete).toBe(true)
    expect(r.newPhase).toBe('complete')
  })

  it('extracts WRITTEN_INPUT line', () => {
    const r = parseEngineResponse(
      'Write it down.\nWRITTEN_INPUT: Derive the kinetic term.',
      'retrieval'
    )
    expect(r.requestsWrittenInput).toBe(true)
    expect(r.writtenInputPrompt).toBe('Derive the kinetic term.')
    expect(r.message).not.toMatch(/WRITTEN_INPUT/)
  })
})
