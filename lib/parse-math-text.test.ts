import { describe, expect, it } from 'vitest'
import {
  consumeBeginEndEnvironment,
  fixDoubleBackslashLatexCommands,
  preprocessMathSource,
  splitDisplayMath,
  splitInlineMath,
} from './parse-math-text'

describe('preprocessMathSource', () => {
  it('unwraps ```latex fenced blocks into $$ display', () => {
    const raw = 'Intro\n```latex\nx^2\n```\nOut'
    const out = preprocessMathSource(raw)
    expect(out).toContain('$$')
    expect(out).toContain('x^2')
  })

  it('unwraps ```math with same-line lang', () => {
    const raw = '```math \\alpha ```'
    expect(preprocessMathSource(raw)).toContain('\\alpha')
  })

  it('normalizes CRLF', () => {
    expect(preprocessMathSource('a\r\nb')).toBe('a\nb')
  })
})

describe('fixDoubleBackslashLatexCommands', () => {
  it('collapses \\frac-style doubled backslashes before commands', () => {
    expect(fixDoubleBackslashLatexCommands('\\\\frac{1}{2}')).toBe('\\frac{1}{2}')
  })
})

describe('splitDisplayMath', () => {
  it('splits $$ display math', () => {
    const parts = splitDisplayMath('before $$E=mc^2$$ after')
    expect(parts).toEqual([
      { type: 'text', value: 'before ' },
      { type: 'display', value: 'E=mc^2' },
      { type: 'text', value: ' after' },
    ])
  })

  it('splits \\[ \\] display math', () => {
    const parts = splitDisplayMath(String.raw`\[ \psi \]`)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({ type: 'display', value: ' \\psi ' })
  })

  it('extracts full \\begin{...}\\end{...} block', () => {
    const s = String.raw`\begin{align}x\end{align}`
    const parts = splitDisplayMath(s)
    expect(parts).toHaveLength(1)
    expect(parts[0].type).toBe('display')
    expect(parts[0].value).toContain('begin{align}')
    expect(parts[0].value).toContain('end{align}')
  })

  it('handles text around begin/end', () => {
    const s = String.raw`Hi \begin{equation}a\end{equation} bye`
    const parts = splitDisplayMath(s)
    expect(parts.map(p => p.type)).toEqual(['text', 'display', 'text'])
    expect(parts[0].value).toBe('Hi ')
    expect(parts[2].value).toBe(' bye')
  })
})

describe('consumeBeginEndEnvironment', () => {
  it('returns inner and end index for simple environment', () => {
    const s = String.raw`\begin{aligned}a\end{aligned}`
    const r = consumeBeginEndEnvironment(s, 0)
    expect(r).not.toBeNull()
    expect(r!.inner).toBe('a')
    expect(s.slice(0, r!.end)).toBe(s)
  })

  it('returns null for incomplete environment', () => {
    expect(consumeBeginEndEnvironment(String.raw`\begin{align}x`, 0)).toBeNull()
  })
})

describe('splitInlineMath', () => {
  it('splits $...$ inline', () => {
    const parts = splitInlineMath('a $x$ b')
    expect(parts).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'inline', value: 'x' },
      { type: 'text', value: ' b' },
    ])
  })

  it('splits \\(...\\) inline', () => {
    const parts = splitInlineMath(String.raw`pre \(\alpha\) post`)
    expect(parts.some(p => p.type === 'inline' && p.value.includes('alpha'))).toBe(true)
  })

  it('skips $$ when scanning for single dollar', () => {
    const parts = splitInlineMath('$$')
    expect(parts).toHaveLength(1)
    expect(parts[0].type).toBe('text')
  })
})
