import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./chat-completion', () => ({
  createChatCompletion: vi.fn(),
}))

import { generateFeedback } from './feedback-generator'
import { createChatCompletion } from './chat-completion'

const session = {
  id: 's',
  sourceMaterial: 'notes',
  sourceTitle: 'Quantum',
  concepts: [
    { name: 'a', definition: 'd', relationships: [] as string[] },
    { name: 'b', definition: 'd', relationships: [] },
    { name: 'c', definition: 'd', relationships: [] },
    { name: 'd', definition: 'd', relationships: [] },
    { name: 'e', definition: 'd', relationships: [] },
  ],
  phase: 'interpretation' as const,
  turnsInPhase: 1,
  conversationHistory: [
    { role: 'articulate' as const, content: 'Q?' },
    { role: 'student' as const, content: 'A.' },
  ],
  createdAt: 1,
}

describe('generateFeedback', () => {
  beforeEach(() => {
    vi.mocked(createChatCompletion).mockReset()
  })

  it('parses JSON feedback from model', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              strength: 'Solid grasp of $E=mc^2$.',
              areaToDevelop: 'Work on tensor notation.',
              recommendedNextStep: 'Practice index gymnastics.',
            }),
          },
        },
      ],
    } as Awaited<ReturnType<typeof createChatCompletion>>)

    const fb = await generateFeedback(session)
    expect(fb.strength).toContain('Solid')
    expect(fb.areaToDevelop).toContain('tensor')
    expect(fb.recommendedNextStep).toMatch(/Practice/i)
  })

  it('extracts JSON from markdown-fenced response', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '```json\n' +
              JSON.stringify({
                strength: 's',
                areaToDevelop: 'a',
                recommendedNextStep: 'n',
              }) +
              '\n```',
          },
        },
      ],
    } as Awaited<ReturnType<typeof createChatCompletion>>)

    const fb = await generateFeedback(session)
    expect(fb.strength).toBe('s')
  })
})
