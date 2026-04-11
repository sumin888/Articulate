import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/chat-completion'

export const maxDuration = 30

// Fallback principles from the Stanford framework (used if PDF fetch fails)
const FALLBACK_PRINCIPLES = [
  'Criteria should describe observable, assessable behaviors — not effort or attitude.',
  'Each performance level must be described with concrete behavioral anchors, not vague qualifiers like "good" or "adequate".',
  'Weights should reflect the relative importance of each criterion to the core learning objective.',
  'The highest performance level should describe genuine mastery, not just compliance.',
  'Criteria should be mutually exclusive — no single student behavior should satisfy two criteria simultaneously.',
]

let cachedPrinciples: string[] | null = null

async function getStanfordPrinciples(): Promise<string[]> {
  if (cachedPrinciples) return cachedPrinciples

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(
      'https://www.stanford.edu/dept/CTL/cgi-bin/docs/newsletter/rubrics.pdf',
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer())
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      let extracted: string[] = []
      try {
        const result = await parser.getText()
        const text = result.text

        // Extract sentences that map to the known principle themes
        const principlePatterns = [
          /criteria[^.]*observable[^.]*/i,
          /performance level[^.]*behavioral anchor[^.]*/i,
          /weight[^.]*relative importance[^.]*/i,
          /highest performance[^.]*mastery[^.]*/i,
          /criteria[^.]*mutually exclusive[^.]*/i,
        ]

        for (const pattern of principlePatterns) {
          const match = text.match(pattern)
          if (match) extracted.push(match[0].trim())
        }
      } finally {
        try { await parser.destroy() } catch { /* ignore */ }
      }

      if (extracted.length >= 3) {
        cachedPrinciples = extracted
        return cachedPrinciples
      }
    }
  } catch {
    // Fall through to hardcoded principles
  }

  cachedPrinciples = FALLBACK_PRINCIPLES
  return cachedPrinciples
}

type Criterion = {
  id: string
  name: string
  description: string
  weight?: number
  levels?: { label: string; description: string }[]
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { criteria?: Criterion[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

  const criteria = body?.criteria
  if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
    return NextResponse.json({ error: 'criteria array is required in the request body' }, { status: 400 })
  }

  const principles = await getStanfordPrinciples()
  const principleList = principles.map((p, i) => `${i + 1}. ${p}`).join('\n')

  const rubricJson = JSON.stringify(
    criteria.map(c => ({ id: c.id, name: c.name, description: c.description, weight: c.weight, levels: c.levels })),
    null,
    2
  )

  const systemPrompt = `You are an expert in assessment design. Use the following principles from Stanford's performance task rubric framework to evaluate and improve the provided rubric.

Stanford principles:
${principleList}

For each criterion in the rubric, return a suggestion object with:
- criterionId
- issue: what is weak about the current description (one sentence)
- suggestion: a concrete rewrite of the criterion description that follows Stanford's framework
- anchorExample: a one-sentence example of what the highest performance level looks like for this criterion

Return ONLY valid JSON. No markdown.`

  const userPrompt = `Rubric ID: ${id}

Criteria:
${rubricJson}`

  let suggestions: unknown
  try {
    const response = await createChatCompletion({
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
    const raw = response.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON in response')
    suggestions = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }

  return NextResponse.json({ stanfordAligned: true, ...((suggestions as Record<string, unknown>) ?? {}) })
}
