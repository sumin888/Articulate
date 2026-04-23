import OpenAI from 'openai'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODELS = [
  'openai/gpt-5.4',
  'anthropic/claude-sonnet-4.6',
  'google/gemma-3-12b-it:free',
]

type ChatParams = Parameters<typeof openrouter.chat.completions.create>[0]

export async function createChatCompletion(params: Omit<ChatParams, 'model' | 'stream'>): Promise<OpenAI.Chat.ChatCompletion> {
  let lastError: unknown
  for (const model of MODELS) {
    try {
      const result = await openrouter.chat.completions.create({ ...params, model, stream: false })
      console.log('[model used]', model)
      return result
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 || status === 503 || status === 404) {
        lastError = err
        continue
      }
      throw err
    }
  }
  throw lastError
}

export async function* createStreamingChatCompletion(
  params: Omit<ChatParams, 'model' | 'stream'>
): AsyncGenerator<string> {
  let lastError: unknown
  for (const model of MODELS) {
    try {
      const stream = await openrouter.chat.completions.create({ ...params, model, stream: true })
      console.log('[model used streaming]', model)
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) yield delta
      }
      return
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 429 || status === 503 || status === 404) {
        lastError = err
        continue
      }
      throw err
    }
  }
  throw lastError
}
