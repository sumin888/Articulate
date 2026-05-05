'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { WidgetRenderer, type WidgetPayload } from '@/components/widgets/WidgetRenderer'

type ChatMessage =
  | { role: 'instructor' | 'agent'; content: string }
  | { role: 'widget'; payload: WidgetPayload }

type Props = {
  courseId: string
  token: string
  onSourceUploaded?: (sourceId: string) => void
}

export function ConversationalSurface({ courseId, token, onSourceUploaded }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'agent', content: 'Welcome! Upload course materials (PDF, DOCX, or PPTX) to get started, or describe what you\'d like to configure. The calibration agent will analyze your sources and draft a profile before asking you any targeted questions.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return
    setInput('')
    setLoading(true)
    setMessages(m => [...m, { role: 'instructor', content }])
    scrollToBottom()

    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: content }),
      })
      const data = await res.json() as { reply: string }
      setMessages(m => [...m, { role: 'agent', content: data.reply }])
    } catch {
      setMessages(m => [...m, { role: 'agent', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  async function uploadFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'pptx'].includes(ext ?? '')) {
      setMessages(m => [...m, { role: 'agent', content: `I can't process **${file.name}** — please upload a PDF, DOCX, or PPTX.` }])
      return
    }

    setLoading(true)
    setMessages(m => [...m, { role: 'instructor', content: `📎 ${file.name}` }])
    scrollToBottom()

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json() as { reply: string; sourceId?: string }
      setMessages(m => [...m, { role: 'agent', content: data.reply }])
      if (data.sourceId) onSourceUploaded?.(data.sourceId)
    } catch {
      setMessages(m => [...m, { role: 'agent', content: 'File upload failed. Please try again.' }])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  function handleWidgetResponse(requestId: string, field: string, value: unknown) {
    setMessages(m => [...m, { role: 'instructor', content: `[Widget response for ${field}: ${JSON.stringify(value)}]` }])
    // Send the widget response as a message to the backend
    sendMessage(`Widget response for "${field}": ${JSON.stringify(value)}`)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <div
      className={`flex h-full flex-col transition-colors ${isDragging ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="rounded-xl bg-background/90 px-6 py-3 text-sm font-medium shadow-lg">Drop to upload</p>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'instructor' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'widget' ? (
              <div className="w-full max-w-sm">
                <WidgetRenderer payload={msg.payload} onResponse={handleWidgetResponse} />
              </div>
            ) : (
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'instructor'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}>
                {msg.role === 'agent' && <span className="mb-1 block text-xs font-semibold text-muted-foreground">Agent</span>}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-card border border-border px-4 py-2.5">
              <span className="block text-xs font-semibold text-muted-foreground mb-2">Agent</span>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            accept=".pdf,.docx,.pptx"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-border p-2.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Upload file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Message or drag & drop a file…"
            disabled={loading}
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="rounded-xl bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
