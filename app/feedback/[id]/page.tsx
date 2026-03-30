'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import FeedbackCard from '@/components/FeedbackCard'
import { ArticulateLogo } from '@/components/ArticulateLogo'
import { MathText } from '@/components/MathText'
import { Feedback, Message } from '@/lib/session-store'

type FeedbackPageProps = {
  params: Promise<{ id: string }>
}

export default function FeedbackPage({ params }: FeedbackPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [history, setHistory] = useState<Message[]>([])
  const [sourceTitle, setSourceTitle] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const genRes = await fetch(`/api/session/${id}/feedback`, { method: 'POST' })
      if (genRes.ok) {
        const genData = await genRes.json()
        if (genData.feedback) setFeedback(genData.feedback)
      }

      const getRes = await fetch(`/api/session/${id}/feedback`)
      if (getRes.ok) {
        const getData = await getRes.json()
        setHistory(getData.history ?? [])
        setSourceTitle(getData.sourceTitle ?? '')
        if (getData.feedback) setFeedback(getData.feedback)
      }

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
          <ArticulateLogo href="/" size="sm" />
        </header>
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Generating feedback…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <ArticulateLogo href="/" size="sm" />
      </header>
      <main className="px-4 py-12">
        <div className="mx-auto max-w-xl">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => router.push('/start')}
              className="mb-4 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              ← New session
            </button>
            <h1 className="font-display text-2xl font-bold text-foreground">Session feedback</h1>
            {sourceTitle && (
              <p className="mt-1 text-sm text-muted-foreground">{sourceTitle}</p>
            )}
          </div>

          {feedback ? (
            <FeedbackCard feedback={feedback} />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">Could not generate feedback.</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>{showTranscript ? '▾' : '▸'}</span>
                {showTranscript ? 'Hide transcript' : 'Show full transcript'}
              </button>

              {showTranscript && (
                <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
                  {history.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === 'articulate'
                            ? 'bg-muted text-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {msg.role === 'articulate' && (
                          <span className="mb-0.5 block text-xs font-semibold text-muted-foreground">
                            Articulate
                          </span>
                        )}
                        <MathText
                          variant={msg.role === 'student' ? 'onPrimary' : 'default'}
                          className="text-sm"
                        >
                          {msg.content}
                        </MathText>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => router.push('/start')}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start new session
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
