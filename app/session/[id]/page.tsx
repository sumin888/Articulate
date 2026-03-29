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

  // Load existing session on mount
  useEffect(() => {
    async function loadSession() {
      const res = await fetch(`/api/session/${id}/feedback`)
      if (!res.ok) return
      const data = await res.json()
      if (data.history?.length) {
        setMessages(data.history)
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800 text-sm tracking-tight">Articulate</span>
        <button
          onClick={endSession}
          disabled={loading || messages.length < 2}
          className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          End session & get feedback
        </button>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow messages={messages} phase={phase} loading={loading} />
      </div>

      {/* Input area */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-4 space-y-3">
        {error && <p className="text-xs text-red-500 px-1">{error}</p>}

        {sessionComplete && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Session complete.</p>
            <button
              onClick={endSession}
              disabled={loading}
              className="px-5 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 disabled:opacity-50"
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
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="px-4 py-3 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
