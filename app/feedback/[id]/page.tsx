'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import FeedbackCard from '@/components/FeedbackCard'
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Generating feedback…</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/start')}
            className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-block transition-colors"
          >
            ← New session
          </button>
          <h1 className="font-display text-2xl font-bold text-foreground">Session feedback</h1>
          {sourceTitle && (
            <p className="text-sm text-muted-foreground mt-1">{sourceTitle}</p>
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
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <span>{showTranscript ? '▾' : '▸'}</span>
              {showTranscript ? 'Hide transcript' : 'Show full transcript'}
            </button>

            {showTranscript && (
              <div className="mt-4 space-y-3 border border-border rounded-2xl p-4 bg-card">
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
                        <span className="block text-xs font-semibold text-muted-foreground mb-0.5">
                          Articulate
                        </span>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
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
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start new session
          </button>
        </div>
      </div>
    </main>
  )
}
