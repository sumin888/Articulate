'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

type Choice = { id: string; text: string }
type LogicData = {
  topic: string
  stimulus: string
  question: string
  choices: Choice[]
  correctId: string
  explanation: string
}

export default function LogicPage() {
  const [topic, setTopic] = useState('')
  const [data, setData] = useState<LogicData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [score, setScore] = useState(0)
  const [attempted, setAttempted] = useState(0)

  async function generate(currentTopic?: string) {
    const t = (currentTopic ?? topic).trim()
    if (!t || loading) return
    setError('')
    setLoading(true)
    setSelected(null)
    try {
      const res = await fetch('/api/reflect/logic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setData(d)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to generate question. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function submitAnswer(choiceId: string) {
    if (selected || !data) return
    setSelected(choiceId)
    setAttempted(a => a + 1)
    if (choiceId === data.correctId) {
      setScore(s => s + 1)
    }
  }

  function nextQuestion() {
    if (!data) return
    generate(data.topic)
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">Logic</h1>
            <p className="text-sm text-muted-foreground">LSAT-style logical reasoning questions.</p>
          </div>
          {attempted > 0 && (
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{score}/{attempted}</p>
              <p className="text-xs text-muted-foreground">correct</p>
            </div>
          )}
        </div>

        {!data && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <label className="block text-sm font-medium text-foreground mb-2">Topic</label>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="e.g. Climate policy"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => generate()}
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
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{data.topic}</p>
              <p className="text-sm text-foreground leading-relaxed">{data.stimulus}</p>
              <p className="text-sm font-semibold text-foreground border-t border-border pt-3">{data.question}</p>
            </div>

            <div className="space-y-2">
              {data.choices.map(choice => {
                const isSelected = selected === choice.id
                const isCorrect = choice.id === data.correctId
                const showResult = selected !== null

                let classes =
                  'flex items-start gap-3 w-full rounded-xl border p-3 text-sm text-left transition-colors '
                if (!showResult) {
                  classes += isSelected
                    ? 'border-primary bg-primary/10 cursor-default'
                    : 'border-border bg-card hover:border-primary/40 cursor-pointer'
                } else if (isCorrect) {
                  classes += 'border-green-500/40 bg-green-500/10 cursor-default'
                } else if (isSelected) {
                  classes += 'border-destructive/40 bg-destructive/10 cursor-default'
                } else {
                  classes += 'border-border bg-card cursor-default opacity-60'
                }

                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => submitAnswer(choice.id)}
                    disabled={selected !== null}
                    className={classes}
                  >
                    <span className="shrink-0 font-semibold text-muted-foreground">{choice.id}.</span>
                    <span className="flex-1 leading-relaxed text-foreground">{choice.text}</span>
                    {showResult && isCorrect && <span className="shrink-0 text-green-600">✓</span>}
                    {showResult && isSelected && !isCorrect && <span className="shrink-0 text-destructive">✗</span>}
                  </button>
                )
              })}
            </div>

            {selected && (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Explanation: </span>
                  {data.explanation}
                </div>
                <button
                  type="button"
                  onClick={nextQuestion}
                  disabled={loading}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Generating…' : 'Next question'}
                </button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="button"
              onClick={() => { setData(null); setScore(0); setAttempted(0) }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Change topic
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
