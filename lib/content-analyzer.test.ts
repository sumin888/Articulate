import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./chat-completion', () => ({
  createChatCompletion: vi.fn(),
}))

import { bootstrapSessionFromMaterial, stripMarkdownJsonFence } from './content-analyzer'
import { createChatCompletion } from './chat-completion'

describe('stripMarkdownJsonFence', () => {
  it('strips ```json fences', () => {
    const raw = '```json\n{"a":1}\n```'
    expect(stripMarkdownJsonFence(raw)).toBe('{"a":1}')
  })

  it('strips bare ``` fences', () => {
    const raw = '```\n{"x":true}\n```'
    expect(stripMarkdownJsonFence(raw)).toBe('{"x":true}')
  })

  it('returns trimmed text when no fence', () => {
    expect(stripMarkdownJsonFence('  plain  ')).toBe('plain')
  })
})

const fiveConcepts = [
  { name: 'A', definition: 'd1', relationships: ['r'] as string[] },
  { name: 'B', definition: 'd2', relationships: [] as string[] },
  { name: 'C', definition: 'd3', relationships: [] as string[] },
  { name: 'D', definition: 'd4', relationships: [] as string[] },
  { name: 'E', definition: 'd5', relationships: [] as string[] },
]

describe('bootstrapSessionFromMaterial', () => {
  beforeEach(() => {
    vi.mocked(createChatCompletion).mockReset()
  })

  it('returns concepts and combined opening message', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              concepts: fiveConcepts,
              introduction: 'We reviewed your notes. Three phases. Let us go.',
              firstRecognitionQuestion: 'What is $\\psi$?',
            }),
          },
        },
      ],
    } as Awaited<ReturnType<typeof createChatCompletion>>)

    const result = await bootstrapSessionFromMaterial('x'.repeat(200), 'My notes')

    expect(result.concepts).toHaveLength(5)
    expect(result.concepts[0].name).toBe('A')
    expect(result.openingMessage).toContain('We reviewed your notes')
    expect(result.openingMessage).toContain('What is')
    expect(result.openingMessage).toContain('$\\psi$')
  })

  it('parses JSON embedded in prose using brace match', async () => {
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [
        {
          message: {
            content: `Here is JSON:\n${JSON.stringify({
              concepts: fiveConcepts,
              introduction: 'Intro line one. Let us go.',
              firstRecognitionQuestion: 'First Q?',
            })}\n`,
          },
        },
      ],
    } as Awaited<ReturnType<typeof createChatCompletion>>)

    const result = await bootstrapSessionFromMaterial('material', 'T')
    expect(result.openingMessage).toContain('Intro line')
  })
})
