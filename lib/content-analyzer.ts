import { createChatCompletion } from './chat-completion'
import { Concept } from './session-store'

export async function extractConcepts(text: string): Promise<Concept[]> {
  const response = await createChatCompletion({
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Extract exactly 5 key concepts from this study material. Return ONLY a JSON object, no other text.

Material:
${text.slice(0, 8000)}

Required JSON format (return nothing else):
{"concepts":[{"name":"short name","definition":"one sentence definition","relationships":["related1","related2"]},{"name":"short name","definition":"one sentence definition","relationships":["related1"]}]}`,
      },
    ],
  })

  const text_content = response.choices[0]?.message?.content ?? ''

  try {
    const parsed = JSON.parse(text_content)
    return parsed.concepts as Concept[]
  } catch {
    const match = text_content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not parse concepts from response')
    const parsed = JSON.parse(match[0])
    return parsed.concepts as Concept[]
  }
}
