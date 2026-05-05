import { embedText, cosineSimilarity, topKByEmbedding } from './embeddings'
import { listCourseChunks, getChunkById } from './db'
import type { ScoredChunk } from './embeddings'

const CITATION_VERIFICATION_THRESHOLD = 0.7

export type RawCitation = {
  phrase: string
  chunk_id: string
  confidence: number
}

export type VerifiedCitation = {
  phrase: string
  chunkId: string
  confidence: number
  sourceId: string
  pageNumber?: number | null
  slideNumber?: number | null
  paragraphIndex?: number | null
}

// ── cite_sources tool definition (for OpenRouter function calling) ─────────────

export const CITE_SOURCES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'cite_sources',
    description: 'Identify which specific phrases in your response are grounded in the provided source chunks. Call this alongside your text response.',
    parameters: {
      type: 'object',
      properties: {
        citations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phrase: { type: 'string', description: 'Exact phrase or sentence span from your response that is grounded in a source' },
              chunk_id: { type: 'string', description: 'ID of the source chunk supporting this phrase' },
              confidence: { type: 'number', description: 'Confidence 0.0–1.0 that the phrase is grounded in this chunk' },
            },
            required: ['phrase', 'chunk_id', 'confidence'],
          },
        },
      },
      required: ['citations'],
    },
  },
}

// ── Retrieve relevant chunks for a student message ────────────────────────────

export async function retrieveRelevantChunks(courseId: string, studentMessage: string, k = 5): Promise<ScoredChunk[]> {
  const chunks = listCourseChunks(courseId)
  if (chunks.length === 0) return []

  try {
    const queryEmb = await embedText(studentMessage)
    return topKByEmbedding(queryEmb, chunks, k)
  } catch {
    // Embedding failure — return empty, session continues without citations
    return []
  }
}

// ── Verify citations against chunk embeddings ─────────────────────────────────

export async function verifyCitations(rawCitations: RawCitation[]): Promise<VerifiedCitation[]> {
  if (rawCitations.length === 0) return []

  const verified: VerifiedCitation[] = []

  for (const citation of rawCitations) {
    const chunk = getChunkById(citation.chunk_id)
    if (!chunk) continue

    // Compute phrase–chunk similarity to verify grounding
    let score = citation.confidence
    try {
      const [phraseEmb, chunkEmb] = await Promise.all([
        embedText(citation.phrase),
        chunk.embeddingJson ? Promise.resolve(JSON.parse(chunk.embeddingJson) as number[]) : embedText(chunk.text),
      ])
      score = cosineSimilarity(phraseEmb, chunkEmb)
    } catch {
      // If embedding fails, fall back to model-reported confidence
    }

    if (score >= CITATION_VERIFICATION_THRESHOLD) {
      verified.push({
        phrase: citation.phrase,
        chunkId: chunk.id,
        confidence: score,
        sourceId: chunk.sourceId,
        pageNumber: chunk.pageNumber,
        slideNumber: chunk.slideNumber,
        paragraphIndex: chunk.paragraphIndex,
      })
    }
  }

  return verified
}

// ── Parse cite_sources tool call from LLM response ────────────────────────────

export function parseCitationsFromToolCall(toolCalls: { function: { name: string; arguments: string } }[] | undefined): RawCitation[] {
  if (!toolCalls) return []
  const citeCall = toolCalls.find(tc => tc.function.name === 'cite_sources')
  if (!citeCall) return []
  try {
    const args = JSON.parse(citeCall.function.arguments) as { citations: RawCitation[] }
    return args.citations ?? []
  } catch {
    return []
  }
}

// ── Build context string for system prompt ────────────────────────────────────

export function buildChunkContext(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) return ''
  return chunks
    .map((c, i) => `[chunk_id:${c.chunkId}] ${c.text}`)
    .join('\n\n')
}
