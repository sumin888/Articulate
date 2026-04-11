import { NextRequest, NextResponse } from 'next/server'
import { createChatCompletion } from '@/lib/chat-completion'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: { argument?: string; analysis?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 })
  }

  const { argument, analysis } = body ?? {}
  if (!argument?.trim() || !analysis?.trim()) {
    return NextResponse.json({ error: 'argument and analysis are required' }, { status: 400 })
  }

  const prompt = `A student read the following model argument and wrote an analysis of what made it effective.

Model argument:
${argument}

Student's analysis:
${analysis}

Give structured feedback on the student's analysis. Assess:
1. Whether they identified the core claim
2. Whether they recognized the use of evidence
3. Whether they understood the reasoning structure
4. What they missed or could go deeper on

Return ONLY valid JSON in this exact shape:
{
  "strengths": "...",
  "gaps": "...",
  "suggestion": "..."
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
    return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 })
  }
}
