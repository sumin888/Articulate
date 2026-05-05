import OpenAI from 'openai'

/**
 * Normalize env mistakes: stray quotes, accidental `Bearer ` prefix, whitespace/BOM.
 * OpenRouter keys are normally `sk-or-v1-…` from https://openrouter.ai/settings/keys
 */
function openRouterApiKey(): string | undefined {
  let raw = process.env.OPENROUTER_API_KEY
  if (!raw) return undefined
  raw = raw.replace(/^\uFEFF/, '').trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim()
  }
  if (/^bearer\s+/i.test(raw)) {
    raw = raw.replace(/^bearer\s+/i, '').trim()
  }
  return raw || undefined
}

/** Lazy client so each request reads the latest OPENROUTER_API_KEY from env. */
function getOpenRouter(): OpenAI {
  const apiKey = openRouterApiKey()
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || 'Articulate'

  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': referer,
      'X-Title': title,
    },
  })
}


const MODELS = [
  'openai/gpt-5.4',
  'anthropic/claude-sonnet-4.6',
  'google/gemma-3-12b-it:free',
]

function ensureOpenRouterKey(): void {
  if (!openRouterApiKey()) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Add your key to .env.local — create one at https://openrouter.ai/keys — then restart the dev server.'
    )
  }
}

function formatOpenRouterError(err: unknown): Error {
  const status = (err as { status?: number })?.status
  const msg = (err as { message?: string })?.message ?? String(err)
  if (status === 401) {
    return new Error(
      'OpenRouter returned 401 (not authorized). Your key is set but OpenRouter does not accept it: regenerate at https://openrouter.ai/settings/keys, paste only the key (no "Bearer "), save .env.local in the Articulate folder next to package.json, restart npm run dev, and confirm your account has credits. Optional: set OPENROUTER_HTTP_REFERER and OPENROUTER_APP_TITLE if your org requires app attribution.'
    )
  }
  return err instanceof Error ? err : new Error(msg)
}

type ChatParams = OpenAI.Chat.ChatCompletionCreateParams

export async function createChatCompletion(params: Omit<ChatParams, 'model' | 'stream'>): Promise<OpenAI.Chat.ChatCompletion> {
  ensureOpenRouterKey()
  let lastError: unknown
  for (const model of MODELS) {
    try {
      const result = await getOpenRouter().chat.completions.create({ ...params, model, stream: false })
      console.log('[model used]', model)
      return result
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 401) throw formatOpenRouterError(err)
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
  ensureOpenRouterKey()
  let lastError: unknown
  for (const model of MODELS) {
    try {
      const stream = await getOpenRouter().chat.completions.create({ ...params, model, stream: true })
      console.log('[model used streaming]', model)
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) yield delta
      }
      return
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 401) throw formatOpenRouterError(err)
      if (status === 429 || status === 503 || status === 404) {
        lastError = err
        continue
      }
      throw err
    }
  }
  throw lastError
}
