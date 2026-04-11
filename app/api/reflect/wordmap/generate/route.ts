import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/chat-completion'
import { stripThinking } from '@/lib/strip-thinking'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: { work?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

  const work = body?.work?.trim()
  if (!work) {
    return NextResponse.json({ error: 'work is required' }, { status: 400 })
  }

  // Plain text format avoids JSON escaping issues with literary quotes/apostrophes
  const prompt = `You are a literature expert. The student has requested a passage based on: "${work}".

Select a well-known passage (100–150 words) from a public domain work that matches the request — prioritise Shakespeare, Jane Austen, Charles Dickens, Mark Twain, Homer, Dante, Mary Shelley, Tolstoy, Dostoevsky, Edgar Allan Poe, Plato, Emily Dickinson, or Walt Whitman, or any work published before 1928.

The passage must have clear internal development — a sequence of ideas, events, or arguments that unfold in logical order.

Reply using EXACTLY this format and nothing else:

TITLE: [work title]
AUTHOR: [author name]
YEAR: [publication year]
---
[the passage text here]`

  try {
    const response = await createChatCompletion({
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = stripThinking(response.choices[0]?.message?.content?.trim() ?? '')
    console.log('[wordmap/generate] raw:', raw.slice(0, 300))

    const titleMatch = raw.match(/^TITLE:\s*(.+)/m)
    const authorMatch = raw.match(/^AUTHOR:\s*(.+)/m)
    const yearMatch = raw.match(/^YEAR:\s*(.+)/m)
    const excerptMatch = raw.match(/---\s*([\s\S]+)/)

    if (!titleMatch || !authorMatch || !excerptMatch) {
      console.error('[wordmap/generate] parse failed on:', raw)
      return NextResponse.json({ error: 'Model returned an unexpected format. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      workTitle: titleMatch[1].trim(),
      author: authorMatch[1].trim(),
      publicationYear: yearMatch?.[1].trim() ?? '',
      excerpt: excerptMatch[1].trim(),
    })
  } catch (err: unknown) {
    console.error('[wordmap/generate] error:', err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to generate passage: ${detail}` }, { status: 500 })
  }
}
