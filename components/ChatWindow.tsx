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

const PHASE_CLASS: Record<string, string> = {
  recognition: 'bg-primary/15 text-primary border-primary/30',
  retrieval: 'bg-secondary/15 text-secondary border-secondary/30',
  interpretation: 'bg-accent/15 text-accent border-accent/30',
  complete: 'bg-muted text-muted-foreground border-border',
}

export default function ChatWindow({ messages, phase, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-card/40 backdrop-blur-sm">
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PHASE_CLASS[phase] ?? PHASE_CLASS.recognition}`}
        >
          {PHASE_LABEL[phase] ?? phase}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'articulate'
                  ? 'bg-card border border-border text-foreground shadow-sm'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {msg.role === 'articulate' && (
                <span className="block text-xs font-semibold text-muted-foreground mb-1">Articulate</span>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
              <span className="block text-xs font-semibold text-muted-foreground mb-2">Articulate</span>
              <div className="flex gap-1.5 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"
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
