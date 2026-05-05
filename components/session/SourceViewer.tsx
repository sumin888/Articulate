'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { MessageCitation } from '@/lib/session-store'

type Props = {
  citation: MessageCitation | null
  onClose: () => void
}

type SourceMeta = {
  filename: string
  fileType: 'pdf' | 'docx' | 'pptx'
}

export function SourceViewer({ citation, onClose }: Props) {
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null)
  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [pptxText, setPptxText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!citation) { setSourceMeta(null); setDocxHtml(null); setPptxText(null); return }
    setLoading(true)

    // Fetch source metadata from the sources list in the course context
    fetch(`/api/sources/${citation.sourceId}/meta`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { filename: string; fileType: string } | null) => {
        if (data) setSourceMeta({ filename: data.filename, fileType: data.fileType as SourceMeta['fileType'] })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [citation?.sourceId])

  // For DOCX: fetch server-converted HTML
  useEffect(() => {
    if (!citation || !sourceMeta || sourceMeta.fileType !== 'docx') { setDocxHtml(null); return }

    fetch(`/api/sources/${citation.sourceId}/html`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(html => setDocxHtml(html))
      .catch(() => setDocxHtml('<p>Could not render document.</p>'))
  }, [citation?.sourceId, sourceMeta?.fileType])

  if (!citation) return null

  const fileUrl = `/api/sources/${citation.sourceId}/file`
  const locationLabel = citation.pageNumber
    ? `Page ${citation.pageNumber}`
    : citation.slideNumber
    ? `Slide ${citation.slideNumber}`
    : citation.paragraphIndex !== null && citation.paragraphIndex !== undefined
    ? `Paragraph ${citation.paragraphIndex + 1}`
    : 'Source'

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{sourceMeta?.filename ?? 'Source'}</p>
          <p className="text-xs text-muted-foreground">{locationLabel}</p>
        </div>
        <button type="button" onClick={onClose} className="ml-2 shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Cited phrase callout */}
      <div className="shrink-0 border-b border-border bg-primary/5 px-3 py-2">
        <p className="text-xs text-muted-foreground mb-1">Cited phrase</p>
        <blockquote className="text-xs text-foreground italic leading-relaxed">
          &ldquo;{citation.phrase}&rdquo;
        </blockquote>
      </div>

      {/* Viewer body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">Loading…</div>
        )}

        {!loading && sourceMeta?.fileType === 'pdf' && (
          <iframe
            src={`${fileUrl}#page=${citation.pageNumber ?? 1}`}
            className="h-full w-full"
            title="PDF viewer"
          />
        )}

        {!loading && sourceMeta?.fileType === 'docx' && docxHtml && (
          <div className="p-4">
            <DocxViewer html={docxHtml} highlightPhrase={citation.phrase} paragraphIndex={citation.paragraphIndex} />
          </div>
        )}

        {!loading && sourceMeta?.fileType === 'pptx' && (
          <PptxViewer sourceId={citation.sourceId} slideNumber={citation.slideNumber} highlightPhrase={citation.phrase} />
        )}

        {!loading && !sourceMeta && (
          <div className="p-4 space-y-3">
            <p className="text-xs font-medium text-foreground">Cited text</p>
            <blockquote className="rounded-lg bg-muted p-3 text-xs text-muted-foreground italic">
              &ldquo;{citation.phrase}&rdquo;
            </blockquote>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DOCX viewer with paragraph highlighting ───────────────────────────────────

function DocxViewer({ html, highlightPhrase, paragraphIndex }: { html: string; highlightPhrase: string; paragraphIndex?: number | null }) {
  const highlighted = paragraphIndex != null
    ? highlightParagraph(html, paragraphIndex)
    : highlightPhrase
    ? highlightText(html, highlightPhrase)
    : html

  return (
    <div
      className="prose prose-sm max-w-none text-foreground [&_mark]:bg-primary/25 [&_mark]:rounded"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

function highlightParagraph(html: string, idx: number): string {
  let count = 0
  return html.replace(/<p([^>]*)>/g, (match, attrs) => {
    const result = count === idx ? `<p${attrs} style="background-color:var(--color-primary,.1);border-radius:4px;padding:2px 4px;">` : match
    count++
    return result
  })
}

function highlightText(html: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

// ── PPTX viewer (text fallback per slide) ─────────────────────────────────────

function PptxViewer({ sourceId, slideNumber, highlightPhrase }: { sourceId: string; slideNumber?: number | null; highlightPhrase: string }) {
  const [slides, setSlides] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sources/${sourceId}/file`)
      .then(r => r.arrayBuffer())
      .then(async buf => {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(buf)
        const slideFiles = Object.keys(zip.files)
          .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
          .sort((a, b) => {
            const na = parseInt(a.match(/(\d+)/)?.[1] ?? '0')
            const nb = parseInt(b.match(/(\d+)/)?.[1] ?? '0')
            return na - nb
          })
        const texts = await Promise.all(slideFiles.map(async name => {
          const xml = await zip.files[name].async('string')
          const paras: string[] = []
          const paraMatches = xml.matchAll(/<a:p[^>]*>([\s\S]*?)<\/a:p>/g)
          for (const m of paraMatches) {
            const ts: string[] = []
            const tMatches = m[1].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)
            for (const t of tMatches) {
              const text = t[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
              if (text) ts.push(text)
            }
            if (ts.length) paras.push(ts.join(' '))
          }
          return paras.join('\n')
        }))
        setSlides(texts)
      })
      .catch(() => setSlides([]))
      .finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">Loading slides…</div>

  const targetSlide = slideNumber ?? 1
  const displaySlides = slideNumber ? slides.slice(targetSlide - 1, targetSlide) : slides

  return (
    <div className="p-4 space-y-4">
      {displaySlides.map((text, i) => {
        const slideIdx = slideNumber ? targetSlide : i + 1
        const escaped = highlightPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const highlighted = text.replace(new RegExp(`(${escaped})`, 'gi'), '**$1**')
        return (
          <div key={i} className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Slide {slideIdx}</p>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {highlighted.split('**').map((part, j) =>
                j % 2 === 1 ? <mark key={j} className="bg-primary/25 rounded px-0.5">{part}</mark> : part
              )}
            </p>
          </div>
        )
      })}
    </div>
  )
}
