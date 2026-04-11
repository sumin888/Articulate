import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/chat-completion'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: { topic?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

  const topic = body?.topic?.trim()
  if (!topic) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const prompt = `Generate a flashcard deck of 8 cards for the topic: "${topic}".

Each card should test a specific concept, definition, or relationship.
Vary the difficulty: some basic recall, some requiring deeper understanding.

Return ONLY valid JSON in this exact shape:
{
  "deckTitle": "...",
  "cards": [
    { "id": "1", "front": "...", "back": "..." },
    ...
  ]
}`

  try {
    const response = await createChatCompletion({
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to generate deck' }, { status: 500 })
  }
}
