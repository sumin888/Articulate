'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

type TextMapData = {
  articleTitle: string
  articleUrl: string
  wordCount: number
  map: {
    claim: string
    evidence: string[]
    warrant: string
  }
  questions: {
    level: number
    question: string
    answer: string
    explanation: string
  }[]
}

export default function TextMapPage() {
  const [url, setUrl] = useState('')
  const [data, setData] = useState<TextMapData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  async function fetchArticle() {
    if (!url.trim() || loading) return
    setError('')
    setLoading(true)
    setData(null)
    setRevealed(new Set())
    try {
      const res = await fetch('/api/reflect/textmap/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? d.error ?? 'Failed')
      setData(d)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to fetch article. Please try a different URL.')
    } finally {
      setLoading(false)
    }
  }

  function toggleReveal(index: number) {
    setRevealed(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const levelLabels: Record<number, string> = {
    1: 'Factual recall',
    2: 'Inference',
    3: 'Synthesis',
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <ArticulateLogo href="/" size="sm" />
          <Link href="/reflect" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Reflect
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">TextMap</h1>
          <p className="text-sm text-muted-foreground">Paste a URL to any article, then map its argument and answer questions.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <label className="block text-sm font-medium text-foreground">Article URL</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchArticle()}
              placeholder="https://..."
              type="url"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={fetchArticle}
              disabled={!url.trim() || loading}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Fetching…' : 'Fetch article'}
            </button>
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground">Fetching and analyzing article — this may take 5-8 seconds…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {data && (
          <>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">{data.articleTitle}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.wordCount.toLocaleString()} words · <a href={data.articleUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{data.articleUrl}</a></p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-foreground">Argument Structure Map</h2>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Claim</p>
                <p className="text-sm text-foreground leading-relaxed">{data.map.claim}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Evidence</p>
                <ul className="space-y-1.5">
                  {data.map.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                      <span className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-primary/60" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Warrant</p>
                <p className="text-sm text-foreground leading-relaxed">{data.map.warrant}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-foreground">Comprehension Questions</h2>

              {data.questions.map((q, i) => (
                <div key={i} className="border-t border-border pt-4 first:border-0 first:pt-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                      Level {q.level} — {levelLabels[q.level]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{q.question}</p>
                  <button
                    type="button"
                    onClick={() => toggleReveal(i)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {revealed.has(i) ? 'Hide answer' : 'Show answer'}
                  </button>
                  {revealed.has(i) && (
                    <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1">
                      <p className="text-sm font-medium text-foreground">{q.answer}</p>
                      <p className="text-xs text-muted-foreground">{q.explanation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => { setData(null); setUrl('') }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Try another article
            </button>
          </>
        )}
      </main>
    </div>
  )
}
