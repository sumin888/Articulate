'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

type Sentence = { id: string; text: string }
type UnscrambleData = { topic: string; sentences: Sentence[] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function UnscramblePage() {
  const [topic, setTopic] = useState('')
  const [data, setData] = useState<UnscrambleData | null>(null)
  const [shuffled, setShuffled] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  async function generate() {
    if (!topic.trim() || loading) return
    setError('')
    setLoading(true)
    setSubmitted(false)
    try {
      const res = await fetch('/api/reflect/unscramble/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setData(d)
      setShuffled(shuffle(d.sentences))
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to generate. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === targetIndex) return
    const newShuffled = [...shuffled]
    const [item] = newShuffled.splice(dragIndex, 1)
    newShuffled.splice(targetIndex, 0, item)
    setShuffled(newShuffled)
    setDragIndex(targetIndex)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  function moveUp(index: number) {
    if (index === 0) return
    const newShuffled = [...shuffled]
    ;[newShuffled[index - 1], newShuffled[index]] = [newShuffled[index], newShuffled[index - 1]]
    setShuffled(newShuffled)
  }

  function moveDown(index: number) {
    if (index === shuffled.length - 1) return
    const newShuffled = [...shuffled]
    ;[newShuffled[index], newShuffled[index + 1]] = [newShuffled[index + 1], newShuffled[index]]
    setShuffled(newShuffled)
  }

  function checkCorrect(index: number): boolean {
    if (!data || !submitted) return false
    return shuffled[index].id === data.sentences[index].id
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
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Unscramble</h1>
          <p className="text-sm text-muted-foreground">Drag sentences into the correct logical order.</p>
        </div>

        {!data && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <label className="block text-sm font-medium text-foreground mb-2">Topic</label>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="e.g. How vaccines work"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={generate}
                disabled={!topic.trim() || loading}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating…' : 'Start'}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{data.topic}</p>

            <div className="space-y-2">
              {shuffled.map((sentence, i) => {
                const isCorrect = checkCorrect(i)
                const isIncorrect = submitted && !isCorrect
                return (
                  <div
                    key={sentence.id}
                    draggable={!submitted}
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-sm leading-relaxed transition-colors select-none ${
                      submitted
                        ? isCorrect
                          ? 'border-green-500/40 bg-green-500/10 text-foreground'
                          : 'border-destructive/40 bg-destructive/10 text-foreground'
                        : dragIndex === i
                        ? 'border-primary/60 bg-primary/10 cursor-grabbing'
                        : 'border-border bg-card cursor-grab hover:border-primary/30'
                    }`}
                  >
                    <span className="shrink-0 text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
                    <span className="flex-1">{sentence.text}</span>
                    {!submitted && (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveUp(i)}
                          disabled={i === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs leading-none"
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(i)}
                          disabled={i === shuffled.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs leading-none"
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    )}
                    {submitted && (
                      <span className="shrink-0 text-sm">{isCorrect ? '✓' : '✗'}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {!submitted && (
              <button
                type="button"
                onClick={() => setSubmitted(true)}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Submit order
              </button>
            )}

            {submitted && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Correct order</p>
                  {data.sentences.map((s, i) => (
                    <p key={s.id} className="text-sm text-foreground leading-relaxed mb-1">
                      <span className="text-muted-foreground">{i + 1}. </span>{s.text}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShuffled(shuffle(data.sentences)); setSubmitted(false) }}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => { setData(null); setTopic(prev => prev) }}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    New paragraph
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!submitted && (
              <button
                type="button"
                onClick={() => { setData(null) }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Change topic
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
