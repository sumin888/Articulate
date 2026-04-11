import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/chat-completion'
import { stripThinking } from '@/lib/strip-thinking'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: { excerpt?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 }) }

  const excerpt = body?.excerpt?.trim()
  if (!excerpt) return NextResponse.json({ error: 'excerpt is required' }, { status: 400 })

  // Use a line-based format to avoid JSON escaping issues with quoted passage text
  const prompt = `Analyze this passage and produce a WordMap activity.

PASSAGE:
${excerpt}

Instructions:

1. Count how many distinct ideas, events, or main points the passage covers in sequence. Call this N (between 3 and 5).

2. Write a fully articulated description (1–2 sentences) of each point in order.

3. Extract 5–7 specific details from the passage: direct quotes, named characters, concrete images, or precise phrases. Each detail must come directly from the passage text. Assign each detail to one point (use the point number, 1-based).

Reply using EXACTLY this format and nothing else:

N: [number]

POINT 1: [description]
POINT 2: [description]
POINT 3: [description]

DETAIL: [exact text from passage] | BELONGS TO: [point number]
DETAIL: [exact text from passage] | BELONGS TO: [point number]
DETAIL: [exact text from passage] | BELONGS TO: [point number]
DETAIL: [exact text from passage] | BELONGS TO: [point number]
DETAIL: [exact text from passage] | BELONGS TO: [point number]`

  try {
    const response = await createChatCompletion({
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = stripThinking(response.choices[0]?.message?.content?.trim() ?? '')
    console.log('[wordmap/structure] raw:', raw.slice(0, 400))

    const nMatch = raw.match(/^N:\s*(\d+)/m)
    if (!nMatch) {
      console.error('[wordmap/structure] no N found in:', raw)
      return NextResponse.json({ error: 'Model returned an unexpected format. Please try again.' }, { status: 500 })
    }
    const n = Math.min(Math.max(parseInt(nMatch[1], 10), 3), 5)

    // Parse POINT lines
    const developments: { order: number; description: string }[] = []
    for (let i = 1; i <= n; i++) {
      const m = raw.match(new RegExp(`POINT ${i}:\\s*(.+?)(?=\\nPOINT|\\nDETAIL|\\nN:|$)`, 's'))
      if (m) developments.push({ order: i, description: m[1].trim() })
    }

    // Parse DETAIL lines
    const detailLines = [...raw.matchAll(/DETAIL:\s*(.+?)\s*\|\s*BELONGS TO:\s*(\d+)/g)]
    const details = detailLines.map((m, idx) => ({
      id: `d${idx + 1}`,
      text: m[1].trim(),
      targetIndex: Math.min(Math.max(parseInt(m[2], 10) - 1, 0), n - 1),
    }))

    if (developments.length < 3 || details.length < 3) {
      console.error('[wordmap/structure] incomplete parse. developments:', developments.length, 'details:', details.length)
      return NextResponse.json({ error: 'Model returned incomplete data. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ n, developments, details })
  } catch (err: unknown) {
    console.error('[wordmap/structure] error:', err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to analyze passage: ${detail}` }, { status: 500 })
  }
}
