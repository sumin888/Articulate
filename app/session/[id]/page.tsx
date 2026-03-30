'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import ChatWindow from '@/components/ChatWindow'
import { ArticulateLogo } from '@/components/ArticulateLogo'
import MathInput from '@/components/MathInput'
import { SessionHistoryRail } from '@/components/session/SessionHistoryRail'
import { SessionStudyRail } from '@/components/session/SessionStudyRail'
import { Message, Phase } from '@/lib/session-store'

type SessionPageProps = {
  params: Promise<{ id: string }>
}

export default function SessionPage({ params }: SessionPageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [phase, setPhase] = useState<Phase>('recognition')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestsWrittenInput, setRequestsWrittenInput] = useState(false)
  const [writtenInputPrompt, setWrittenInputPrompt] = useState('')
  const [sessionComplete, setSessionComplete] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadSession() {
      const res = await fetch(`/api/session/${id}/feedback`)
      if (!res.ok) return
      const data = await res.json()
      if (data.history?.length) {
        setMessages(data.history)
      }
      if (data.phase && data.phase !== 'complete') {
        setPhase(data.phase)
      }
    }
    loadSession()
  }, [id])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    setError('')
    setLoading(true)

    const newMessages: Message[] = [...messages, { role: 'student', content }]
    setMessages(newMessages)
    setInput('')
    setRequestsWrittenInput(false)

    try {
      const res = await fetch(`/api/session/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      setMessages([...newMessages, { role: 'articulate', content: data.message }])
      setPhase(data.phase)
      setRequestsWrittenInput(data.requestsWrittenInput ?? false)
      setWrittenInputPrompt(data.writtenInputPrompt ?? '')

      if (data.sessionComplete) {
        setSessionComplete(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function endSession() {
    setLoading(true)
    try {
      const res = await fetch(`/api/session/${id}/feedback`, { method: 'POST' })
      if (res.ok) {
        router.push(`/feedback/${id}`)
      }
    } catch {
      setError('Could not generate feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <ArticulateLogo href="/" size="sm" className="transition-opacity hover:opacity-90" />
        <button
          type="button"
          onClick={endSession}
          disabled={loading || messages.length < 2}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          End session & get feedback
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="hidden h-full min-h-0 w-72 shrink-0 lg:block">
          <SessionHistoryRail currentSessionId={id} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-border lg:border-x">
          <div className="min-h-0 flex-1 overflow-hidden bg-background">
            <ChatWindow messages={messages} phase={phase} loading={loading} />
          </div>

          <div className="shrink-0 space-y-3 border-t border-border bg-card px-4 py-4">
            {error && <p className="px-1 text-xs text-destructive">{error}</p>}

            {sessionComplete && (
              <div className="text-center">
                <p className="mb-2 text-sm text-muted-foreground">Session complete.</p>
                <button
                  type="button"
                  onClick={endSession}
                  disabled={loading}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Generating feedback…' : 'See feedback'}
                </button>
              </div>
            )}

            {!sessionComplete && (
              <>
                {requestsWrittenInput && (
                  <MathInput
                    prompt={writtenInputPrompt}
                    onSubmit={sendMessage}
                    disabled={loading}
                  />
                )}

                {!requestsWrittenInput && (
                  <form
                    onSubmit={(e: { preventDefault: () => void }) => {
                      e.preventDefault()
                      sendMessage(input)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      disabled={loading}
                      placeholder={loading ? 'Thinking…' : 'Your answer…'}
                      autoFocus
                      className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Send
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <div className="hidden h-full min-h-0 w-72 shrink-0 lg:block">
          <SessionStudyRail />
        </div>
      </div>
    </div>
  )
}
