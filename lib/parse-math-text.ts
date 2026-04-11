/**
 * Split a string into plain-text and display-math segments (order preserved).
 * Supports:
 * - $$...$$ and \[ ... \] (display)
 * - \begin{env}...\end{env} (display, including nested environments)
 */

export type DisplaySegment = { type: 'text' | 'display'; value: string }

/**
 * Strip markdown code fences that wrap math (```latex, ```math, ```tex, or bare ```).
 * Fenced blocks are treated as display math (wrapped in $$ for the rest of the pipeline).
 */
export function preprocessMathSource(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n')

  // ```latex / ```math / ```tex with newline after tag
  s = s.replace(
    /```(?:latex|math|tex)\s*\n([\s\S]*?)```/gi,
    (_m, inner: string) => `\n$$${inner.trim()}$$\n`
  )

  // ```lang ... ``` on same line after tag (no newline)
  s = s.replace(
    /```(?:latex|math|tex)\s+([\s\S]*?)```/gi,
    (_m, inner: string) => `\n$$${inner.trim()}$$\n`
  )

  return s.trim()
}

/** Optional: collapse `\\frac`-style double backslashes that some models emit inside delimiters. */
export function fixDoubleBackslashLatexCommands(tex: string): string {
  return tex.replace(/\\\\([a-zA-Z]+)/g, '\\$1')
}

/**
 * Find \begin{env}...\end{env} starting at `start` (must point at backslash of \begin).
 * Handles nested same-name and different-name environments via a stack.
 */
export function consumeBeginEndEnvironment(
  text: string,
  start: number
): { inner: string; end: number } | null {
  if (text.slice(start, start + 7) !== '\\begin{') return null
  const nameMatch = /^\\begin\{([^}]+)\}/.exec(text.slice(start))
  if (!nameMatch) return null
  const rootLen = nameMatch[0].length
  const envName = nameMatch[1]
  let pos = start + rootLen
  const stack: string[] = [envName]

  while (pos < text.length && stack.length > 0) {
    const nextBegin = text.indexOf('\\begin{', pos)
    const nextEnd = text.indexOf('\\end{', pos)

    if (nextEnd === -1) return null

    if (nextBegin !== -1 && nextBegin < nextEnd) {
      const sub = text.slice(nextBegin).match(/^\\begin\{([^}]+)\}/)
      if (!sub) {
        pos = nextBegin + 1
        continue
      }
      stack.push(sub[1])
      pos = nextBegin + sub[0].length
      continue
    }

    const endM = text.slice(nextEnd).match(/^\\end\{([^}]+)\}/)
    if (!endM) return null
    const closing = endM[1]
    if (closing !== stack[stack.length - 1]) {
      return null
    }
    stack.pop()
    const afterEnd = nextEnd + endM[0].length
    if (stack.length === 0) {
      return {
        inner: text.slice(start + rootLen, nextEnd),
        end: afterEnd,
      }
    }
    pos = afterEnd
  }

  return null
}

export function splitDisplayMath(text: string): DisplaySegment[] {
  const out: DisplaySegment[] = []
  let i = 0

  while (i < text.length) {
    const d1 = text.indexOf('$$', i)
    const b1 = text.indexOf('\\[', i)
    const beg = text.indexOf('\\begin{', i)

    const nextDollar = d1 === -1 ? Infinity : d1
    const nextBracket = b1 === -1 ? Infinity : b1
    const nextBegin = beg === -1 ? Infinity : beg
    const next = Math.min(nextDollar, nextBracket, nextBegin)

    if (next === Infinity) {
      out.push({ type: 'text', value: text.slice(i) })
      break
    }

    if (next > i) {
      out.push({ type: 'text', value: text.slice(i, next) })
    }

    if (next === nextDollar) {
      const end = text.indexOf('$$', d1 + 2)
      if (end === -1) {
        out.push({ type: 'text', value: text.slice(next) })
        break
      }
      out.push({ type: 'display', value: text.slice(d1 + 2, end) })
      i = end + 2
      continue
    }

    if (next === nextBracket) {
      const end = text.indexOf('\\]', b1 + 2)
      if (end === -1) {
        out.push({ type: 'text', value: text.slice(next) })
        break
      }
      out.push({ type: 'display', value: text.slice(b1 + 2, end) })
      i = end + 2
      continue
    }

    const consumed = consumeBeginEndEnvironment(text, beg)
    if (!consumed) {
      out.push({ type: 'text', value: text.slice(beg, beg + 7) })
      i = beg + 1
      continue
    }
    out.push({ type: 'display', value: text.slice(beg, consumed.end) })
    i = consumed.end
  }

  return out.length ? out : [{ type: 'text', value: text }]
}

export type InlineSegment = { type: 'text' | 'inline'; value: string }

/**
 * Split a text segment into plain and inline-math pieces.
 * Supports \(...\) and single $...$ (not $$).
 */
export function splitInlineMath(text: string): InlineSegment[] {
  const out: InlineSegment[] = []
  let i = 0

  while (i < text.length) {
    const paren = text.indexOf('\\(', i)
    let dollar = -1
    let s = i
    while (s < text.length) {
      const d = text.indexOf('$', s)
      if (d === -1) break
      if (text[d + 1] === '$') {
        s = d + 2
        continue
      }
      dollar = d
      break
    }

    const nextParen = paren === -1 ? Infinity : paren
    const nextDollar = dollar === -1 ? Infinity : dollar
    const next = Math.min(nextParen, nextDollar)

    if (next === Infinity) {
      out.push({ type: 'text', value: text.slice(i) })
      break
    }

    if (next > i) {
      out.push({ type: 'text', value: text.slice(i, next) })
    }

    if (next === nextParen) {
      const end = text.indexOf('\\)', paren + 2)
      if (end === -1) {
        out.push({ type: 'text', value: text.slice(next) })
        break
      }
      out.push({ type: 'inline', value: text.slice(paren + 2, end) })
      i = end + 2
    } else {
      const start = dollar + 1
      const end = text.indexOf('$', start)
      if (end === -1) {
        out.push({ type: 'text', value: text.slice(next) })
        break
      }
      out.push({ type: 'inline', value: text.slice(start, end) })
      i = end + 1
    }
  }

  return out.length ? out : [{ type: 'text', value: text }]
}