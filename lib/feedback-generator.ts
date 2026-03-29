import { createChatCompletion } from './chat-completion'
import { SessionState, Feedback } from './session-store'

export async function generateFeedback(session: SessionState): Promise<Feedback> {
  const transcript = session.conversationHistory
    .map(m => `${m.role === 'articulate' ? 'Articulate' : 'Student'}: ${m.content}`)
    .join('\n\n')

  const conceptList = session.concepts
    .map(c => `- ${c.name}: ${c.definition}`)
    .join('\n')

  const response = await createChatCompletion({
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `You are generating end-of-session feedback for a student after an oral practice session.

Source material: ${session.sourceTitle}

Key concepts covered:
${conceptList}

Full session transcript:
${transcript}

Generate feedback in this exact JSON format:
{
  "strength": "2-3 sentences on what the student did well and why it matters. Be specific — reference what they actually said.",
  "areaToDevelop": "2-3 sentences on the specific gap the session exposed. Name the exact concept or reasoning failure. Be honest.",
  "recommendedNextStep": "One concrete action the student should take before their next session. Specific, actionable, not generic."
}

Return only valid JSON, nothing else.`,
      },
    ],
  })

  const text_content = response.choices[0]?.message?.content ?? ''

  try {
    return JSON.parse(text_content) as Feedback
  } catch {
    const match = text_content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse feedback')
    return JSON.parse(match[0]) as Feedback
  }
}
