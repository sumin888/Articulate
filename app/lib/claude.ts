import OpenAI from 'openai'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})

const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
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
