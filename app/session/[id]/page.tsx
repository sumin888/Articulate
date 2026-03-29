'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import ChatWindow from '@/components/ChatWindow'
import MathInput from '@/components/MathInput'
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
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-5 py-3 bg-background/90 backdrop-blur-md border-b border-border shrink-0">
        <span className="font-display font-bold text-sm tracking-tight">Articulate</span>
        <button
          type="button"
          onClick={endSession}
          disabled={loading || messages.length < 2}
          className="text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          End session & get feedback
        </button>
      </header>

      <div className="flex-1 overflow-hidden">
        <ChatWindow messages={messages} phase={phase} loading={loading} />
      </div>

      <div className="shrink-0 bg-card border-t border-border px-4 py-4 space-y-3">
        {error && <p className="text-xs text-destructive px-1">{error}</p>}

        {sessionComplete && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Session complete.</p>
            <button
              type="button"
              onClick={endSession}
              disabled={loading}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
                  className="px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
