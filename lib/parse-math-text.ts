/**
 * Split a string into plain-text and display-math segments (order preserved).
 * Supports $$...$$ and \[ ... \] (display).
 */
export function splitDisplayMath(text: string): { type: 'text' | 'display'; value: string }[] {
  const out: { type: 'text' | 'display'; value: string }[] = []
  let i = 0

  while (i < text.length) {
    const d1 = text.indexOf('$$', i)
    const b1 = text.indexOf('\\[', i)
    const nextDollar = d1 === -1 ? Infinity : d1
    const nextBracket = b1 === -1 ? Infinity : b1
    const next = Math.min(nextDollar, nextBracket)

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
    } else {
      const end = text.indexOf('\\]', b1 + 2)
      if (end === -1) {
        out.push({ type: 'text', value: text.slice(next) })
        break
      }
      out.push({ type: 'display', value: text.slice(b1 + 2, end) })
      i = end + 2
    }
  }

  return out.length ? out : [{ type: 'text', value: text }]
}

/**
 * Split a text segment into plain and inline-math pieces.
 * Supports \(...\) and single $...$ (not $$).
 */
export function splitInlineMath(text: string): { type: 'text' | 'inline'; value: string }[] {
  const out: { type: 'text' | 'inline'; value: string }[] = []
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
