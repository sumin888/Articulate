'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mic, ArrowLeft } from 'lucide-react'

const LOADING_MESSAGES = [
  'Reading your notes…',
  'Extracting key concepts…',
  'Building your examiner…',
  'Almost ready…',
]

export default function StartSessionPage() {
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      setMsgIndex(0)
      return
    }
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [loading])

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formData = new FormData()
      if (mode === 'file' && file) {
        formData.append('file', file)
      } else if (mode === 'text' && text.trim()) {
        formData.append('text', text.trim())
      } else {
        setError('Please provide a PDF or paste some notes.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      router.push(`/session/${data.sessionId}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg animated-gradient flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-foreground">Articulate</span>
          </div>
          <span className="w-16" aria-hidden />
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
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{LOADING_MESSAGES[msgIndex]}</p>
            </div>
          ) : (
            <>
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

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Start session
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
