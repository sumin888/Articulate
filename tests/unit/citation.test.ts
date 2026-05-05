import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/embeddings', () => ({
  embedText: vi.fn(),
  cosineSimilarity: vi.fn(),
  topKByEmbedding: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  listCourseChunks: vi.fn(),
  getChunkById: vi.fn(),
}))

vi.mock('@/lib/chat-completion', () => ({
  createChatCompletion: vi.fn(),
  createStreamingChatCompletion: vi.fn(),
}))

import { parseCitationsFromToolCall, buildChunkContext } from '@/lib/citation'
import { listCourseChunks, getChunkById } from '@/lib/db'
import { embedText, cosineSimilarity, topKByEmbedding } from '@/lib/embeddings'
import type { Chunk } from '@/lib/db'

describe('parseCitationsFromToolCall', () => {
  it('returns empty array when tool_calls is undefined', () => {
    expect(parseCitationsFromToolCall(undefined)).toEqual([])
  })

  it('returns empty array when no cite_sources call', () => {
    const calls = [{ function: { name: 'other_tool', arguments: '{}' } }]
    expect(parseCitationsFromToolCall(calls)).toEqual([])
  })

  it('parses citations from cite_sources call', () => {
    const calls = [{
      function: {
        name: 'cite_sources',
        arguments: JSON.stringify({ citations: [{ phrase: 'hello world', chunk_id: 'ch1', confidence: 0.9 }] }),
      },
    }]
    const result = parseCitationsFromToolCall(calls)
    expect(result).toHaveLength(1)
    expect(result[0].phrase).toBe('hello world')
    expect(result[0].chunk_id).toBe('ch1')
    expect(result[0].confidence).toBe(0.9)
  })

  it('returns empty on malformed JSON', () => {
    const calls = [{ function: { name: 'cite_sources', arguments: '{bad json' } }]
    expect(parseCitationsFromToolCall(calls)).toEqual([])
  })
})

describe('buildChunkContext', () => {
  it('returns empty string for no chunks', () => {
    expect(buildChunkContext([])).toBe('')
  })

  it('formats chunks with chunk_id prefix', () => {
    const chunks = [
      { chunkId: 'ch1', text: 'Quantum entanglement is...', score: 0.9, sourceId: 'src1', pageNumber: 1, slideNumber: null, paragraphIndex: null },
    ]
    const result = buildChunkContext(chunks)
    expect(result).toContain('[chunk_id:ch1]')
    expect(result).toContain('Quantum entanglement is...')
  })
})

describe('source ingestion helpers', () => {
  it('chunkIntoSlides splits on form-feed', async () => {
    const { chunkIntoSlides } = await import('@/lib/content-analyzer')
    const text = 'This is slide one content with enough text.\fThis is slide two content with enough text.\fThis is slide three content with enough text.'
    const chunks = chunkIntoSlides(text)
    expect(chunks.length).toBe(3)
    expect(chunks[0].text).toContain('slide one')
  })

  it('chunkIntoSlides filters short chunks', async () => {
    const { chunkIntoSlides } = await import('@/lib/content-analyzer')
    const text = 'ok\fabc\fThis is a valid chunk with enough content to pass the filter.'
    const chunks = chunkIntoSlides(text)
    // 'ok' and 'abc' are < 20 chars, should be filtered
    expect(chunks.every(c => c.text.length >= 20)).toBe(true)
  })
})
