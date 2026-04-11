/**
 * Some free models (e.g. DeepSeek, Qwen) emit <think>...</think> reasoning
 * blocks before their actual response. Strip them before parsing.
 */
export function stripThinking(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim()
}
