import { createChatCompletion } from './chat-completion'
import { Feedback, SessionState } from './session-store'

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
        content: `You are generating end-of-session feedback after a practice oral session (low stakes — no grades, no rubric, no numeric scores).

Source material: ${session.sourceTitle}

Key concepts covered:
${conceptList}

Full session transcript:
${transcript}

Tone: like a sharp but fair instructor debrief — specific and honest, similar to a strong post-oral comment: name real strengths with references to what the student actually said; name concrete gaps (e.g. hand-wavy evidence, confused terminology, described a result without showing a derivation when asked); give one actionable next step. Not harsh, not fluffy.

Generate feedback in this exact JSON format:
{
  "strength": "2-3 sentences. Be specific — reference what they actually said.",
  "areaToDevelop": "2-3 sentences. Name the gap or reasoning weakness clearly.",
  "recommendedNextStep": "One concrete action before their next practice session."
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
