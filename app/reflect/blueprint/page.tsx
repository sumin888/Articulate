'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

type BlueprintData = { topic: string; argument: string }
type FeedbackData = { strengths: string; gaps: string; suggestion: string }

export default function BlueprintPage() {
  const [topic, setTopic] = useState('')
  const [blueprint, setBlueprint] = useState<BlueprintData | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [feedback, setFeedback] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [error, setError] = useState('')

  async function generateArgument() {
    if (!topic.trim() || loading) return
    setError('')
    setLoading(true)
    setFeedback(null)
    setAnalysis('')
    try {
      const res = await fetch('/api/reflect/blueprint/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setBlueprint(data)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to generate argument. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnalysis() {
    if (!analysis.trim() || !blueprint || feedbackLoading) return
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/reflect/blueprint/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ argument: blueprint.argument, analysis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setFeedback(data)
    } catch {
      setError('Failed to get feedback. Please try again.')
    } finally {
      setFeedbackLoading(false)
    }
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
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Blueprint</h1>
          <p className="text-sm text-muted-foreground">Read a model argument, then analyze what makes it effective.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <label className="block text-sm font-medium text-foreground mb-2">Topic</label>
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateArgument()}
              placeholder="e.g. The benefits of spaced repetition"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={generateArgument}
              disabled={!topic.trim() || loading}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating…' : blueprint ? 'New argument' : 'Generate'}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>

        {blueprint && (
          <>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                Model argument — {blueprint.topic}
              </p>
              <p className="text-sm text-foreground leading-relaxed">{blueprint.argument}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <label className="block text-sm font-medium text-foreground">
                What made this argument effective?
              </label>
              <textarea
                value={analysis}
                onChange={e => setAnalysis(e.target.value)}
                placeholder="Describe what you noticed: the structure, use of evidence, reasoning, etc."
                rows={5}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={submitAnalysis}
                disabled={!analysis.trim() || feedbackLoading}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {feedbackLoading ? 'Getting feedback…' : 'Submit analysis'}
              </button>
            </div>
          </>
        )}

        {feedback && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Feedback</p>
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Strengths</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{feedback.strengths}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Gaps</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{feedback.gaps}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Suggestion</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{feedback.suggestion}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
