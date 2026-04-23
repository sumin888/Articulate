'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

import { ArticulateLogo } from '@/components/ArticulateLogo'

type Concept = { name: string; definition: string }

type ProcessingState =
  | { status: 'idle' }
  | { status: 'processing'; statusMsg: string; concepts: Concept[] }
  | { status: 'ready'; sessionId: string; title: string; concepts: Concept[] }
  | { status: 'error'; message: string }

export default function StartSessionPage() {
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<ProcessingState>({ status: 'idle' })
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()

    const formData = new FormData()
    if (mode === 'file' && file) {
      formData.append('file', file)
    } else if (mode === 'text' && text.trim()) {
      formData.append('text', text.trim())
    } else {
      setState({ status: 'error', message: 'Please provide a PDF or paste some notes.' })
      return
    }

    setState({ status: 'processing', statusMsg: 'Starting…', concepts: [] })

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        const msg = typeof data.message === 'string' ? data.message : 'Upload failed.'
        setState({ status: 'error', message: msg })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      const title =
        mode === 'file' && file ? file.name.replace(/\.[^/.]+$/, '') : 'Pasted Notes'
      const concepts: Concept[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const json = line.slice('data:'.length).trim()
          let evt: Record<string, unknown>
          try {
            evt = JSON.parse(json)
          } catch {
            continue
          }

          if (evt.type === 'progress' && typeof evt.message === 'string') {
            setState(prev =>
              prev.status === 'processing'
                ? { ...prev, statusMsg: evt.message as string }
                : prev
            )
          } else if (evt.type === 'concept' && evt.concept) {
            const c = evt.concept as Concept
            concepts.push(c)
            setState(prev =>
              prev.status === 'processing'
                ? { ...prev, statusMsg: 'Extracting key concepts…', concepts: [...concepts] }
                : prev
            )
          } else if (evt.type === 'complete' && typeof evt.sessionId === 'string') {
            setState({ status: 'ready', sessionId: evt.sessionId, title, concepts: [...concepts] })
          } else if (evt.type === 'error' && typeof evt.message === 'string') {
            setState({ status: 'error', message: evt.message })
          }
        }
      }

      // If we closed without a complete event, something went wrong
      setState(prev => {
        if (prev.status === 'processing') {
          return { status: 'error', message: 'Processing ended unexpectedly. Please try again.' }
        }
        return prev
      })
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  const s = state

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <ArticulateLogo href="/" size="sm" />
          <Link
            href="/reflect"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-16 text-right"
          >
            Reflect
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Start a practice session
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Upload a PDF or paste notes. Low stakes — structured oral practice and feedback.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-lg p-6 sm:p-8">
          {s.status === 'ready' ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Session ready — three phases: recognition → retrieval → interpretation
                </p>
              </div>
              {s.concepts.length > 0 && (
                <div className="w-full max-w-sm text-left space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Key concepts
                  </p>
                  {s.concepts.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <span>
                        <span className="font-medium">{c.name}</span>
                        {c.definition ? ` — ${c.definition}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push(`/session/${s.sessionId}`)}
                className="w-full max-w-xs py-3 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
              >
                Start session
              </button>
              <button
                type="button"
                onClick={() => setState({ status: 'idle' })}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Upload different material
              </button>
            </div>
          ) : s.status === 'processing' ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-full max-w-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{s.statusMsg}</p>
                </div>

                {s.concepts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Concepts found
                    </p>
                    {s.concepts.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-foreground/80 animate-in fade-in slide-in-from-bottom-1 duration-300"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {s.status === 'error' && (
                <p className="text-sm text-destructive mb-4">{s.message}</p>
              )}

              <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
                {(['file', 'text'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
                      mode === m
                        ? 'bg-card text-foreground font-medium shadow-sm border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m === 'file' ? 'Upload PDF' : 'Paste Notes'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {mode === 'file' ? (
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                      file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => setFile(e.target.files?.[0] ?? null)}
                    />
                    {file ? (
                      <div>
                        <p className="text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">Click to select a PDF</p>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                          Lecture notes, textbook chapters, papers
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Paste your notes, lecture transcript, or any study material here..."
                    rows={8}
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                >
                  Analyze &amp; build session
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          Practice only — no rubric or scores. Three phases: recognition → retrieval → interpretation.
        </p>
      </main>
    </div>
  )
}
