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

  const prompt = `Write a model argument paragraph (150-200 words) on the topic: "${topic}".

The argument should be well-structured with:
- A clear claim (thesis)
- At least two pieces of evidence
- Explicit reasoning connecting evidence to the claim
- A brief conclusion

This is a model argument for students to analyze. Make it genuinely good — clear, specific, and persuasive.

Return ONLY valid JSON in this exact shape:
{
  "topic": "...",
  "argument": "..."
}`

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
    return NextResponse.json({ error: 'Failed to generate argument' }, { status: 500 })
  }
}
