import { createChatCompletion } from './chat-completion'
import { Concept } from './session-store'

/** Excerpt size for the single bootstrap LLM call (concepts + opening). */
const BOOTSTRAP_MATERIAL_CHARS = 12_000

/** Session engine expects a handful of anchors; models often return 3–7 items. */
const TARGET_CONCEPT_COUNT = 5

export type BootstrapSessionResult = {
  concepts: Concept[]
  openingMessage: string
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
 * One LLM round-trip: key concepts plus the first assistant turn (intro + concrete Recognition question).
 */
export async function bootstrapSessionFromMaterial(
  fullMaterial: string,
  sourceTitle: string
): Promise<BootstrapSessionResult> {
  const excerpt = fullMaterial.slice(0, BOOTSTRAP_MATERIAL_CHARS)

  const response = await createChatCompletion({
    max_tokens: 2500,
    messages: [
      {
        role: 'user',
        content: `You are preparing a practice oral session on uploaded study material (STEM / CS notes, lectures, etc.).

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
- "introduction": 3–6 sentences, natural spoken examiner tone. Say you have reviewed their notes and name 2–4 concrete topics, definitions, or results that actually appear above (not vague phrases like "the material"). Say this is ungraded practice. Explain the flow in order: Recognition (check they recognize key objects, terms, and what each piece is for), then Retrieval (precise statements, steps, derivations, equations where relevant), then Interpretation (meaning, limits, how it fits together). End with a short bridge like "Let's go." Do NOT ask any question in this field. Do NOT use the strings PHASE_COMPLETE or SESSION_COMPLETE anywhere.
- "firstRecognitionQuestion": ONE question only, for the Recognition phase. It must be specific to their content — name a key object, equation, quantity, or definition from the notes and ask a pointed check (answerable in a few sentences). Do NOT ask for "central focus", "in your own words what is this about", "why it matters in STEM", or other broad essay-style prompts. Do NOT repeat the full three-phase roadmap here.
- For any equations or symbols in "introduction" or "firstRecognitionQuestion", use LaTeX inside delimiters: inline \\(...\\) or single-dollar $...$, display on its own line with $$...$$ or \\[...\\] or \\begin{...}...\\end{...}.
- In "concepts" definitions, if you include notation, use the same LaTeX delimiter rules so downstream text stays renderable.

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
