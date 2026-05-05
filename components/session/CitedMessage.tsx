'use client'

import { MathText } from '@/components/MathText'
import type { MessageCitation } from '@/lib/session-store'

type Props = {
  content: string
  citations: MessageCitation[]
  onCitationClick: (citation: MessageCitation) => void
  variant?: 'default' | 'onPrimary'
}

export function CitedMessage({ content, citations, onCitationClick, variant = 'default' }: Props) {
  if (citations.length === 0) {
    return <MathText variant={variant}>{content}</MathText>
  }

  // Split content into segments: plain text and cited phrases
  const segments = buildSegments(content, citations)

  return (
    <span>
      {segments.map((seg, i) =>
        seg.citation ? (
          <button
            key={i}
            type="button"
            onClick={() => onCitationClick(seg.citation!)}
            className="inline underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            title="Click to view source"
          >
            <MathText variant={variant}>{seg.text}</MathText>
          </button>
        ) : (
          <MathText key={i} variant={variant}>{seg.text}</MathText>
        )
      )}
    </span>
  )
}

type Segment = { text: string; citation?: MessageCitation }

function buildSegments(content: string, citations: MessageCitation[]): Segment[] {
  // Sort citations by first occurrence in content
  const sorted = [...citations].sort((a, b) => {
    const ia = content.indexOf(a.phrase)
    const ib = content.indexOf(b.phrase)
    return ia - ib
  })

  const segments: Segment[] = []
  let pos = 0

  for (const citation of sorted) {
    const idx = content.indexOf(citation.phrase, pos)
    if (idx === -1) continue

    if (idx > pos) {
      segments.push({ text: content.slice(pos, idx) })
    }
    segments.push({ text: citation.phrase, citation })
    pos = idx + citation.phrase.length
  }

  if (pos < content.length) {
    segments.push({ text: content.slice(pos) })
  }

  return segments.filter(s => s.text.length > 0)
}
