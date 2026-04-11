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

  const prompt = `Write a coherent 4-6 sentence paragraph on the topic: "${topic}".

The paragraph must have a clear logical or chronological order — each sentence should follow naturally from the previous one.

Return ONLY valid JSON in this exact shape:
{
  "topic": "...",
  "sentences": [
    { "id": "1", "text": "..." },
    { "id": "2", "text": "..." },
    ...
  ]
}

The sentences array must be in the CORRECT order. The frontend will shuffle them.`

  try {
    const response = await createChatCompletion({
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to generate paragraph' }, { status: 500 })
  }
}
