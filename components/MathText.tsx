'use client'

import { useMemo } from 'react'
import katex from 'katex'
import { splitDisplayMath, splitInlineMath } from '@/lib/parse-math-text'

type Variant = 'default' | 'onPrimary'

type Props = {
  children: string
  className?: string
  /** `onPrimary` forces KaTeX to inherit bubble text color (student messages). */
  variant?: Variant
}

function renderKatex(tex: string, displayMode: boolean): string {
  const trimmed = tex.trim()
  if (!trimmed) return ''
  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return trimmed
  }
}

export function MathText({ children, className = '', variant = 'default' }: Props) {
  const nodes = useMemo(() => {
    const displayParts = splitDisplayMath(children)
    const elements: React.ReactNode[] = []
    let k = 0

    for (const part of displayParts) {
      if (part.type === 'display') {
        const html = renderKatex(part.value, true)
        elements.push(
          <div
            key={k++}
            className="my-2 overflow-x-auto text-center [&_.katex-display]:my-0"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
        continue
      }

      const inlineParts = splitInlineMath(part.value)
      for (const seg of inlineParts) {
        if (seg.type === 'text') {
          if (!seg.value) continue
          elements.push(
            <span key={k++} className="whitespace-pre-wrap">
              {seg.value}
            </span>
          )
        } else {
          const html = renderKatex(seg.value, false)
          elements.push(
            <span
              key={k++}
              className="inline-block align-middle [&_.katex]:text-[0.95em]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
      }
    }

    return elements
  }, [children])

  const variantClass =
    variant === 'onPrimary' ? 'math-on-primary text-primary-foreground' : ''

  return <div className={`break-words leading-relaxed ${variantClass} ${className}`.trim()}>{nodes}</div>
}
