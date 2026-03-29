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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500">Generating feedback…</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-block"
          >
            ← New session
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Session feedback</h1>
          {sourceTitle && (
            <p className="text-sm text-gray-500 mt-1">{sourceTitle}</p>
          )}
        </div>

        {/* Feedback cards */}
        {feedback ? (
          <FeedbackCard feedback={feedback} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-sm text-gray-500">Could not generate feedback.</p>
          </div>
        )}

        {/* Transcript toggle */}
        {history.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>{showTranscript ? '▾' : '▸'}</span>
              {showTranscript ? 'Hide transcript' : 'Show full transcript'}
            </button>

            {showTranscript && (
              <div className="mt-4 space-y-3 border border-gray-200 rounded-xl p-4 bg-white">
                {history.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === 'articulate'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-gray-900 text-white'
                      }`}
                    >
                      {msg.role === 'articulate' && (
                        <span className="block text-xs font-semibold text-gray-400 mb-0.5">Articulate</span>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Start again */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 transition-colors"
          >
            Start new session
          </button>
        </div>
      </div>
    </main>
  )
}
