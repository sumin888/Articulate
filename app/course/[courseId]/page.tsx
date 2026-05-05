'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArticulateLogo } from '@/components/ArticulateLogo'

export default function CourseLandingPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params)
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function startSession() {
    setStarting(true)
    setError('')
    const res = await fetch(`/api/courses/${courseId}/sessions`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { sessionId: string }
      router.push(`/session/${data.sessionId}`)
    } else {
      const data = await res.json() as { error: string }
      setError(data.error ?? 'Could not start session.')
      setStarting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <ArticulateLogo href="/" size="md" className="mx-auto" />
        <div>
          <p className="text-base font-semibold text-foreground">Practice Session</p>
          <p className="mt-1 text-sm text-muted-foreground">Your instructor has set up this session using calibrated course materials.</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="button"
          onClick={startSession}
          disabled={starting}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {starting ? 'Starting…' : 'Start practice session'}
        </button>
        <p className="text-xs text-muted-foreground">Sessions are ungraded practice. You can end early at any time.</p>
      </div>
    </div>
  )
}
