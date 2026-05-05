import OpenAI from 'openai'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (_client) return _client
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

export async function embedText(text: string): Promise<number[]> {
  const res = await getClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8192),
  })
  return res.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await getClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map(t => t.slice(0, 8192)),
  })
  return res.data.map(d => d.embedding)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export type ScoredChunk = {
  chunkId: string
  text: string
  score: number
  sourceId: string
  pageNumber?: number | null
  slideNumber?: number | null
  paragraphIndex?: number | null
}

export function topKByEmbedding(
  queryEmbedding: number[],
  chunks: { id: string; sourceId: string; text: string; embeddingJson: string | null; pageNumber: number | null; slideNumber: number | null; paragraphIndex: number | null }[],
  k: number
): ScoredChunk[] {
  const scored = chunks
    .filter(c => c.embeddingJson)
    .map(c => {
      const emb = JSON.parse(c.embeddingJson!) as number[]
      return { chunkId: c.id, text: c.text, score: cosineSimilarity(queryEmbedding, emb), sourceId: c.sourceId, pageNumber: c.pageNumber, slideNumber: c.slideNumber, paragraphIndex: c.paragraphIndex }
    })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}
