import { Redis } from '@upstash/redis'
import { createChatCompletion } from './chat-completion'
import { embedBatch } from './embeddings'
import {
  createSource,
  insertChunk,
  insertSourceConcept,
  updateChunkEmbedding,
  listChunks,
  newId,
} from './db'
import type { Source, Chunk } from './db'

const FILE_TTL = 60 * 60 * 24 * 30 // 30 days
const CHUNK_MAX_CHARS = 500

function getRedis() {
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
}

export type LocationMeta = {
  pageNumber?: number
  slideNumber?: number
  paragraphIndex?: number
  bbox?: { x: number; y: number; w: number; h: number }
}

export type RawChunk = {
  text: string
  location: LocationMeta
}

// ── File storage (base64 in Redis) ─────────────────────────────────────────────

export async function storeFile(courseId: string, fileBuffer: Buffer, filename: string): Promise<string> {
  const key = `file:${courseId}:${newId()}:${filename}`
  const b64 = fileBuffer.toString('base64')
  await getRedis().set(key, b64, { ex: FILE_TTL })
  return key
}

export async function retrieveFile(redisKey: string): Promise<Buffer | null> {
  const b64 = await getRedis().get<string>(redisKey)
  if (!b64) return null
  return Buffer.from(typeof b64 === 'string' ? b64 : JSON.stringify(b64), 'base64')
}

// ── Text extraction ────────────────────────────────────────────────────────────

export async function extractPdf(buffer: Buffer): Promise<RawChunk[]> {
  const { extractText } = await import('unpdf')
  const { text: pages } = await extractText(new Uint8Array(buffer), { mergePages: false })
  const pagesArr = Array.isArray(pages) ? pages : [pages as string]

  const chunks: RawChunk[] = []
  for (let i = 0; i < pagesArr.length; i++) {
    const pageText = (pagesArr[i] ?? '').trim()
    if (pageText.length < 20) continue
    // Split long pages into sub-chunks
    const subChunks = splitIntoSubChunks(pageText, CHUNK_MAX_CHARS)
    for (const sub of subChunks) {
      chunks.push({ text: sub, location: { pageNumber: i + 1 } })
    }
  }
  return chunks
}

export async function extractDocx(buffer: Buffer): Promise<RawChunk[]> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  const paragraphs = result.value.split('\n').filter(p => p.trim().length > 10)

  const chunks: RawChunk[] = []
  let current = ''
  let startParagraph = 0
  let paraIdx = 0

  for (const para of paragraphs) {
    if ((current + ' ' + para).length > CHUNK_MAX_CHARS && current.length > 0) {
      chunks.push({ text: current.trim(), location: { paragraphIndex: startParagraph } })
      current = para
      startParagraph = paraIdx
    } else {
      current = current ? current + ' ' + para : para
    }
    paraIdx++
  }
  if (current.trim().length > 20) {
    chunks.push({ text: current.trim(), location: { paragraphIndex: startParagraph } })
  }
  return chunks
}

export async function extractPptx(buffer: Buffer): Promise<RawChunk[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)
  const chunks: RawChunk[] = []

  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] ?? '0')
      const numB = parseInt(b.match(/(\d+)/)?.[1] ?? '0')
      return numA - numB
    })

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('string')
    const text = extractTextFromPptxXml(xml)
    if (text.trim().length < 20) continue
    const subChunks = splitIntoSubChunks(text, CHUNK_MAX_CHARS)
    for (const sub of subChunks) {
      chunks.push({ text: sub, location: { slideNumber: i + 1 } })
    }
  }
  return chunks
}

function extractTextFromPptxXml(xml: string): string {
  // Extract <a:t> text nodes (OOXML text runs)
  const textParts: string[] = []
  const rMatches = xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)
  for (const m of rMatches) {
    const text = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim()
    if (text) textParts.push(text)
  }
  // Group by paragraph (between <a:p> tags)
  const paras: string[] = []
  const paraMatches = xml.matchAll(/<a:p[^>]*>([\s\S]*?)<\/a:p>/g)
  for (const m of paraMatches) {
    const paraXml = m[1]
    const ts: string[] = []
    const tMatches = paraXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)
    for (const t of tMatches) {
      const text = t[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      if (text) ts.push(text)
    }
    if (ts.length) paras.push(ts.join(' '))
  }
  return paras.length > 0 ? paras.join('\n') : textParts.join(' ')
}

function splitIntoSubChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const parts: string[] = []
  let i = 0
  while (i < text.length) {
    const slice = text.slice(i, i + maxChars)
    const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '))
    const end = lastBreak > maxChars * 0.5 ? i + lastBreak + 1 : i + maxChars
    parts.push(text.slice(i, end).trim())
    i = end
  }
  return parts.filter(p => p.length > 10)
}

// ── Concept extraction ─────────────────────────────────────────────────────────

type ExtractedConcept = { label: string; chunkIndices: number[] }

async function extractConceptsFromChunks(chunks: RawChunk[]): Promise<ExtractedConcept[]> {
  const sampleText = chunks
    .slice(0, 20)
    .map((c, i) => `[${i}] ${c.text}`)
    .join('\n\n')
    .slice(0, 6000)

  const response = await createChatCompletion({
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Extract 5–10 key concepts from this material. For each concept, identify which chunk indices (0-based) support it.

Material chunks (first 20):
${sampleText}

Return ONLY valid JSON, no other text:
{"concepts": [{"label": "concept name", "chunkIndices": [0, 3, 5]}, ...]}`,
    }],
  })

  const raw = response.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as { concepts: ExtractedConcept[] }
    return parsed.concepts?.slice(0, 15) ?? []
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return []
    try {
      const parsed = JSON.parse(m[0]) as { concepts: ExtractedConcept[] }
      return parsed.concepts?.slice(0, 15) ?? []
    } catch {
      return []
    }
  }
}

// ── Main ingestion function ────────────────────────────────────────────────────

export type IngestResult = {
  source: Source
  chunks: Chunk[]
  conceptCount: number
}

export async function ingestFile(
  courseId: string,
  fileBuffer: Buffer,
  filename: string,
  fileType: 'pdf' | 'docx' | 'pptx'
): Promise<IngestResult> {
  // 1. Store original file
  const redisKey = await storeFile(courseId, fileBuffer, filename)

  // 2. Create source record
  const source = createSource(courseId, filename, fileType, redisKey)

  // 3. Extract text with location metadata
  let rawChunks: RawChunk[]
  if (fileType === 'pdf') {
    rawChunks = await extractPdf(fileBuffer)
  } else if (fileType === 'docx') {
    rawChunks = await extractDocx(fileBuffer)
  } else {
    rawChunks = await extractPptx(fileBuffer)
  }

  if (rawChunks.length === 0) throw new Error('No text could be extracted from this file.')

  // 4. Insert chunks
  const dbChunks: Chunk[] = []
  for (let i = 0; i < rawChunks.length; i++) {
    const rc = rawChunks[i]
    const chunk = insertChunk({
      sourceId: source.id,
      chunkIndex: i,
      text: rc.text,
      embeddingJson: null,
      pageNumber: rc.location.pageNumber ?? null,
      slideNumber: rc.location.slideNumber ?? null,
      paragraphIndex: rc.location.paragraphIndex ?? null,
      bboxJson: rc.location.bbox ? JSON.stringify(rc.location.bbox) : null,
    })
    dbChunks.push(chunk)
  }

  // 5. Embed all chunks in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < dbChunks.length; i += BATCH_SIZE) {
    const batch = dbChunks.slice(i, i + BATCH_SIZE)
    try {
      const embeddings = await embedBatch(batch.map(c => c.text))
      for (let j = 0; j < batch.length; j++) {
        updateChunkEmbedding(batch[j].id, JSON.stringify(embeddings[j]))
      }
    } catch {
      // Embedding failure is non-fatal — chunks still stored for BM25
    }
  }

  // 6. Extract concepts with chunk references
  const concepts = await extractConceptsFromChunks(rawChunks)
  for (const concept of concepts) {
    const chunkIds = concept.chunkIndices
      .filter(idx => idx >= 0 && idx < dbChunks.length)
      .map(idx => dbChunks[idx].id)
    insertSourceConcept(source.id, concept.label, chunkIds)
  }

  return { source, chunks: dbChunks, conceptCount: concepts.length }
}

// ── Read helper for tool layer ─────────────────────────────────────────────────

export function readSourceText(sourceId: string, pageRange?: [number, number]): string {
  const chunks = listChunks(sourceId)
  let filtered = chunks
  if (pageRange) {
    filtered = chunks.filter(c => {
      const loc = c.pageNumber ?? c.slideNumber ?? c.paragraphIndex
      if (loc === null) return true
      return loc >= pageRange[0] && loc <= pageRange[1]
    })
  }
  return filtered.map(c => c.text).join('\n\n')
}
