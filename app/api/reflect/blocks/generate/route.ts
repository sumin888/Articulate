import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/chat-completion'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: { topic?: string; difficulty?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

  const topic = body?.topic?.trim()
  if (!topic) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const difficulty = Math.min(Math.max(body?.difficulty ?? 1, 1), 3)
  const complexityNote =
    difficulty === 1
      ? 'Use a simple, clear sentence with 5-8 words total.'
      : difficulty === 2
      ? 'Use a moderately complex sentence with a subordinate clause, 9-13 words total.'
      : 'Use a complex sentence with precise academic vocabulary, 12-18 words total.'

  const prompt = `Generate a sentence assembly exercise on the topic: "${topic}".

${complexityNote}

The sentence must be factually correct and meaningful about the topic.
Split it into 5-8 individual word or short phrase blocks (2-3 words max per block).
Include 1-2 distractor blocks that do not belong in the sentence.

Return ONLY valid JSON in this exact shape:
{
  "topic": "...",
  "correctSentence": "...",
  "blocks": [
    { "id": "1", "text": "...", "isDistractor": false },
    ...
  ]
}

Shuffle the blocks array so they are not in order.`

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
    return NextResponse.json({ error: 'Failed to generate blocks' }, { status: 500 })
  }
}
