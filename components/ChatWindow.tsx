'use client'

import { useEffect, useRef } from 'react'
import { Message } from '@/lib/session-store'

type Props = {
  messages: Message[]
  phase: string
  loading?: boolean
}

const PHASE_LABEL: Record<string, string> = {
  recognition: 'Phase 1 — Recognition',
  retrieval: 'Phase 2 — Retrieval',
  interpretation: 'Phase 3 — Interpretation',
  complete: 'Session Complete',
}

const PHASE_COLOR: Record<string, string> = {
  recognition: 'bg-gray-100 text-gray-600',
  retrieval: 'bg-blue-100 text-blue-700',
  interpretation: 'bg-purple-100 text-purple-700',
  complete: 'bg-green-100 text-green-700',
}

export default function ChatWindow({ messages, phase, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PHASE_COLOR[phase] ?? PHASE_COLOR.recognition}`}>
          {PHASE_LABEL[phase] ?? phase}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'articulate'
                  ? 'bg-white border border-gray-200 text-gray-800'
                  : 'bg-gray-900 text-white'
              }`}
            >
              {msg.role === 'articulate' && (
                <span className="block text-xs font-semibold text-gray-400 mb-1">Articulate</span>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <span className="block text-xs font-semibold text-gray-400 mb-2">Articulate</span>
              <div className="flex gap-1.5 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
