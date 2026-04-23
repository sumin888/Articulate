/** Minimal BM25 retrieval for slide-chunk search. */

const K1 = 1.5
const B = 0.75

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export type BM25Chunk = {
  id: number
  text: string
}

export function buildBM25Index(chunks: BM25Chunk[]) {
  if (!chunks.length) return { query: () => [] }

  const tokenizedDocs = chunks.map(c => tokenize(c.text))
  const avgDl = tokenizedDocs.reduce((s, d) => s + d.length, 0) / tokenizedDocs.length

  const df: Record<string, number> = {}
  for (const doc of tokenizedDocs) {
    const seen = new Set<string>()
    for (const t of doc) {
      if (!seen.has(t)) {
        df[t] = (df[t] ?? 0) + 1
        seen.add(t)
      }
    }
  }

  const N = tokenizedDocs.length

  function score(queryTokens: string[], docIdx: number): number {
    const doc = tokenizedDocs[docIdx]
    const dl = doc.length
    const tf: Record<string, number> = {}
    for (const t of doc) tf[t] = (tf[t] ?? 0) + 1

    let s = 0
    for (const qt of queryTokens) {
      const idf = Math.log((N - (df[qt] ?? 0) + 0.5) / ((df[qt] ?? 0) + 0.5) + 1)
      const tfVal = tf[qt] ?? 0
      s += (idf * (tfVal * (K1 + 1))) / (tfVal + K1 * (1 - B + (B * dl) / avgDl))
    }
    return s
  }

  return {
    query(queryText: string, topK = 3): BM25Chunk[] {
      const qTokens = tokenize(queryText)
      if (!qTokens.length) return []
      return chunks
        .map((c, i) => ({ chunk: c, s: score(qTokens, i) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, topK)
        .map(x => x.chunk)
    },
  }
}
