import { createChatCompletion, createStreamingChatCompletion } from './chat-completion'
import { Concept } from './session-store'

/** Excerpt size for concept extraction and intro generation. */
const BOOTSTRAP_MATERIAL_CHARS = 6_000

/** Session engine expects a handful of anchors; models often return 3–7 items. */
const TARGET_CONCEPT_COUNT = 5

/** Max chars per slide chunk. */
const CHUNK_MAX_CHARS = 500

export type BootstrapSessionResult = {
  concepts: Concept[]
  openingMessage: string
}

export type BootstrapStreamEvent =
  | { type: 'concept'; concept: Concept }
  | { type: 'opening'; openingMessage: string }

export type SlideChunk = {
  id: number
  text: string
}

export function stripMarkdownJsonFence(raw: string): string {
  let t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) t = m[1].trim()
  return t
}

function coerceConcept(c: unknown): Concept | null {
  if (!c || typeof c !== 'object') return null
  const o = c as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!name) return null
  const definition =
    typeof o.definition === 'string' ? o.definition.trim() : 'Key idea from the material.'
  const rel = o.relationships
  const relationships = Array.isArray(rel)
    ? rel.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  return { name: name.slice(0, 240), definition: definition.slice(0, 500), relationships }
}

/** Trim or pad so the session always has exactly TARGET_CONCEPT_COUNT anchors. */
function normalizeConcepts(raw: unknown): Concept[] {
  const arr = Array.isArray(raw) ? raw : []
  const out: Concept[] = []
  for (const item of arr) {
    const c = coerceConcept(item)
    if (c) out.push(c)
    if (out.length >= TARGET_CONCEPT_COUNT) break
  }
  while (out.length < TARGET_CONCEPT_COUNT) {
    const n = out.length + 1
    out.push({
      name: `Supporting idea ${n}`,
      definition: 'A secondary thread in the same notes — use the excerpt when drilling down.',
      relationships: out[0] ? [out[0].name] : [],
    })
  }
  return out
}

/**
 * Split material into slide-level chunks using form-feeds, then double-newlines,
 * then fixed-size fallback.
 */
export function chunkIntoSlides(text: string): SlideChunk[] {
  let rawChunks: string[]

  if (text.includes('\f')) {
    // Form-feed separated slides (common in PDF exports)
    rawChunks = text.split('\f')
  } else if (/\n\n\n/.test(text)) {
    // Triple-newline separated sections
    rawChunks = text.split(/\n{3,}/)
  } else {
    // Fixed-size fallback
    rawChunks = []
    for (let i = 0; i < text.length; i += CHUNK_MAX_CHARS) {
      rawChunks.push(text.slice(i, i + CHUNK_MAX_CHARS))
    }
  }

  return rawChunks
    .map(s => s.trim())
    .filter(s => s.length > 20)
    .slice(0, 200) // cap at 200 chunks
    .map((text, id) => ({ id, text: text.slice(0, CHUNK_MAX_CHARS) }))
}

/**
 * Streaming bootstrap: yields concept events one-by-one, then an opening event.
 * Uses a line-prefixed output format for reliable streaming parse.
 */
export async function* bootstrapSessionStreamable(
  fullMaterial: string,
  sourceTitle: string
): AsyncGenerator<BootstrapStreamEvent> {
  const excerpt = fullMaterial.slice(0, BOOTSTRAP_MATERIAL_CHARS)

  const stream = createStreamingChatCompletion({
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are preparing a practice oral session on the study material below.

Title: ${sourceTitle}

Material excerpt:
${excerpt}

Output exactly in this format — 5 CONCEPT lines, then INTRO, then QUESTION. No blank lines, no extra text.

CONCEPT:{"name":"short name","definition":"one sentence","relationships":["related1"]}
CONCEPT:{"name":"short name","definition":"one sentence","relationships":["related1","related2"]}
CONCEPT:{"name":"short name","definition":"one sentence","relationships":[]}
CONCEPT:{"name":"short name","definition":"one sentence","relationships":["related1"]}
CONCEPT:{"name":"short name","definition":"one sentence","relationships":["related1"]}
INTRO:<spoken examiner, 3-5 sentences. YOU MUST quote or name at least 3 specific terms, definitions, theorems, or equations that appear verbatim in the material excerpt above — not vague phrases like "the material covers several topics". Say this session is ungraded practice with three phases: Recognition, Retrieval, Interpretation. End with "Let's go.">
QUESTION:<ONE Recognition question. Name a specific term, object, quantity, or equation from the notes and ask the student to state what it is or does. Do NOT ask "what is this material about" or any broad question.>

For any math in INTRO or QUESTION: inline $formula$ or \\(formula\\), display $$formula$$ or \\[formula\\].`,
      },
    ],
  })

  let buffer = ''
  const emittedConcepts: Concept[] = []
  let intro = ''
  let firstQ = ''

  function parseLine(line: string) {
    const trimmed = line.trim()
    if (trimmed.startsWith('CONCEPT:')) {
      try {
        const json = trimmed.slice('CONCEPT:'.length).trim()
        const c = coerceConcept(JSON.parse(json))
        if (c && emittedConcepts.length < TARGET_CONCEPT_COUNT) {
          emittedConcepts.push(c)
          return { type: 'concept' as const, concept: c }
        }
      } catch {
        // malformed JSON — skip
      }
    } else if (trimmed.startsWith('INTRO:')) {
      intro = trimmed.slice('INTRO:'.length).trim()
    } else if (trimmed.startsWith('QUESTION:')) {
      firstQ = trimmed.slice('QUESTION:'.length).trim()
    }
    return null
  }

  for await (const delta of stream) {
    buffer += delta
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const result = parseLine(line)
      if (result) yield result
    }
  }

  // Flush remaining buffer (last line with no trailing newline)
  if (buffer.trim()) {
    const result = parseLine(buffer)
    if (result) yield result
  }

  // Pad concepts to target count if needed
  while (emittedConcepts.length < TARGET_CONCEPT_COUNT) {
    const n = emittedConcepts.length + 1
    const padded: Concept = {
      name: `Supporting idea ${n}`,
      definition: 'A secondary thread in the same notes — use the excerpt when drilling down.',
      relationships: emittedConcepts[0] ? [emittedConcepts[0].name] : [],
    }
    emittedConcepts.push(padded)
    yield { type: 'concept', concept: padded }
  }

  if (!intro) {
    intro =
      "I've reviewed your notes. We'll run a short practice oral in three stages: Recognition, then Retrieval, then Interpretation — ungraded, but we'll be precise. Let's go."
  }
  if (!firstQ) {
    const anchor = emittedConcepts[0]?.name ?? 'the main object in your notes'
    firstQ = `Let's start with Recognition. In your notes, what is "${anchor}" — state it in one clear sentence.`
  }

  yield { type: 'opening', openingMessage: `${intro}\n\n${firstQ}` }
}

/**
 * One LLM round-trip: key concepts plus the first assistant turn (intro + concrete Recognition question).
 * Used as a non-streaming fallback if needed.
 */
export async function bootstrapSessionFromMaterial(
  fullMaterial: string,
  sourceTitle: string
): Promise<BootstrapSessionResult> {
  const excerpt = fullMaterial.slice(0, BOOTSTRAP_MATERIAL_CHARS)

  const response = await createChatCompletion({
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are preparing a practice oral session on uploaded study material (STEM / humanities notes, lectures, etc.).

Title / filename hint: ${sourceTitle}

Material (excerpt; the full source may be longer):
${excerpt}

Return ONLY valid JSON, no markdown fences, no other text. Shape:
{
  "concepts": [
    { "name": "short name", "definition": "one sentence", "relationships": ["related1", "related2"] }
  ],
  "introduction": "string",
  "firstRecognitionQuestion": "string"
}

Rules:
- "concepts": exactly 5 objects.
- "introduction": 3–6 sentences, natural spoken examiner tone. Say you have reviewed their notes and name 2–4 concrete topics, definitions, or results that actually appear above (not vague phrases like "the material"). Say this is ungraded practice. Explain the flow in order: Recognition (check they recognize key objects, terms, and what each piece is for), then Retrieval (precise statements, steps, derivations, equations where relevant), then Interpretation (meaning, limits, how it fits together). End with a short bridge like "Let's go." Do NOT ask any question in this field.
- "firstRecognitionQuestion": ONE question only, for the Recognition phase. It must be specific to their content — name a key object, equation, quantity, or definition from the notes and ask a pointed check (answerable in a few sentences). Do NOT ask for "central focus" or other broad essay-style prompts.
- For any equations or symbols, use LaTeX inside delimiters: inline \\(...\\) or $...$, display $$...$$ or \\[...\\].

Return only the JSON object.`,
      },
    ],
  })

  const text_content = response.choices[0]?.message?.content ?? ''
  if (!text_content.trim()) {
    throw new Error('Empty model response for bootstrap')
  }

  const fenced = stripMarkdownJsonFence(text_content)
  let parsed: {
    concepts?: unknown
    introduction?: string
    firstRecognitionQuestion?: string
  }

  try {
    parsed = JSON.parse(fenced) as typeof parsed
  } catch {
    const match = fenced.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse bootstrap JSON from response')
    parsed = JSON.parse(match[0]) as typeof parsed
  }

  const concepts = normalizeConcepts(parsed.concepts)

  let intro = (parsed.introduction ?? '').trim()
  let firstQ = (parsed.firstRecognitionQuestion ?? '').trim()

  if (!firstQ && intro) {
    const parts = intro.split(/\n\n+/)
    if (parts.length > 1) {
      intro = parts.slice(0, -1).join('\n\n').trim()
      firstQ = parts[parts.length - 1].trim()
    }
  }

  if (!intro) {
    intro =
      "I've reviewed your notes. We'll run a short practice oral in three stages: Recognition, then Retrieval, then Interpretation — ungraded, but we'll be precise. Let's go."
  }
  if (!firstQ) {
    const anchor = concepts[0]?.name ?? 'the main object in your notes'
    firstQ = `Let's start with Recognition. In your notes, what is "${anchor}" — state it in one clear sentence.`
  }

  const openingMessage = `${intro}\n\n${firstQ}`
  return { concepts, openingMessage }
}

export async function extractConcepts(text: string): Promise<Concept[]> {
  const response = await createChatCompletion({
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Extract exactly 5 key concepts from this study material. Return ONLY a JSON object, no other text.

Material:
${text.slice(0, 8000)}

Required JSON format (return nothing else):
{"concepts":[{"name":"short name","definition":"one sentence definition","relationships":["related1","related2"]},{"name":"short name","definition":"one sentence definition","relationships":["related1"]}]}`,
      },
    ],
  })

  const text_content = response.choices[0]?.message?.content ?? ''

  try {
    const parsed = JSON.parse(text_content)
    return parsed.concepts as Concept[]
  } catch {
    const match = text_content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse concepts from response')
    const parsed = JSON.parse(match[0])
    return parsed.concepts as Concept[]
  }
}
