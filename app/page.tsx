'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const LOADING_MESSAGES = [
  'Reading your notes…',
  'Extracting key concepts…',
  'Building your examiner…',
  'Almost ready…',
]

export default function UploadPage() {
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!loading) { setMsgIndex(0); return }
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
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Articulate</h1>
          <p className="mt-2 text-gray-500 text-sm">
            Upload your study material. Get examined on it.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-gray-900 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500">{LOADING_MESSAGES[msgIndex]}</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
                {(['file', 'text'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                      mode === m
                        ? 'bg-white shadow-sm text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-700'
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
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                      file ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
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
                        <p className="text-sm font-medium text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-500">Click to select a PDF</p>
                        <p className="text-xs text-gray-400 mt-1">Lecture notes, textbook chapters, papers</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Paste your notes, lecture transcript, or any study material here..."
                    rows={8}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                )}

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Start Session
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 max-w-md mx-auto leading-relaxed">
          Practice only — low stakes, no rubric or scores. Structured oral session and feedback when you finish.
        </p>
      </div>
    </main>
  )
}
