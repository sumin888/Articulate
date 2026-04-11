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

  const prompt = `Generate one LSAT-style logical reasoning question related to the topic: "${topic}".

The question should:
- Present a short argument or scenario (2-4 sentences)
- Ask a logical reasoning question (e.g., "Which of the following most weakens the argument?", "The argument assumes which of the following?", "Which conclusion follows most logically?")
- Have exactly 4 answer choices (A, B, C, D)
- Have exactly one correct answer

Return ONLY valid JSON in this exact shape:
{
  "topic": "...",
  "stimulus": "...",
  "question": "...",
  "choices": [
    { "id": "A", "text": "..." },
    { "id": "B", "text": "..." },
    { "id": "C", "text": "..." },
    { "id": "D", "text": "..." }
  ],
  "correctId": "A",
  "explanation": "..."
}`

  try {
    const response = await createChatCompletion({
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')
    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to generate question' }, { status: 500 })
  }
}
