'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { History, ArrowLeft } from 'lucide-react'
import { ArticulateLogo } from '@/components/ArticulateLogo'
import { ConversationalSurface } from '@/components/instructor/ConversationalSurface'
import { StructuredProfileView } from '@/components/instructor/StructuredProfileView'
import { VersionHistory } from '@/components/instructor/VersionHistory'
import type { Course, Source, CalibrationVersion, RubricVersion } from '@/lib/db'

type CourseData = {
  course: Course
  sources: Source[]
  activeRubric: RubricVersion | null
  activeCalibration: CalibrationVersion | null
  rubricHistory: RubricVersion[]
  calibrationHistory: CalibrationVersion[]
}

export default function InstructorCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params)
  const [token, setToken] = useState('')
  const [courseData, setCourseData] = useState<CourseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('instructor_token') ?? ''
    setToken(saved)
    if (saved) loadData(saved)
    else setLoading(false)
  }, [courseId])

  async function loadData(tok: string) {
    setLoading(true)
    const res = await fetch(`/api/instructor/courses/${courseId}`, { headers: { Authorization: `Bearer ${tok}` } })
    if (res.ok) {
      const data = await res.json() as CourseData
      setCourseData(data)
      setError('')
    } else {
      setError('Could not load course. Check your instructor token.')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
    )
  }

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Enter your instructor token to continue.</p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="INSTRUCTOR_TOKEN"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const t = (e.target as HTMLInputElement).value
                  localStorage.setItem('instructor_token', t)
                  setToken(t)
                  loadData(t)
                }
              }}
            />
            <Link href="/instructor" className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ArticulateLogo href="/" size="sm" />
          <Link href="/instructor" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Courses
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">{courseData?.course.name ?? courseId}</span>
        </div>
        <div className="flex items-center gap-2">
          {courseData && (
            <Link
              href={`/course/${courseId}`}
              target="_blank"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Student view ↗
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowHistory(h => !h)}
            className={`flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors ${showHistory ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History className="h-3.5 w-3.5" /> History
          </button>
        </div>
      </header>

      {/* Two-surface body */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Conversational surface */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border">
          <div className="shrink-0 border-b border-border bg-card/40 px-4 py-2">
            <p className="text-xs font-medium text-muted-foreground">Calibration Chat</p>
            {courseData && (
              <p className="text-xs text-muted-foreground">{courseData.sources.length} source{courseData.sources.length !== 1 ? 's' : ''} uploaded</p>
            )}
          </div>
          <div className="relative min-h-0 flex-1">
            <ConversationalSurface
              courseId={courseId}
              token={token}
              onSourceUploaded={() => loadData(token)}
            />
          </div>
        </div>

        {/* Right: Structured profile view or version history */}
        <div className="hidden w-96 shrink-0 lg:flex lg:flex-col">
          {showHistory ? (
            <div className="flex h-full flex-col">
              <div className="shrink-0 border-b border-border bg-card/40 px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground">Version History</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <VersionHistory
                  calibrationVersions={courseData?.calibrationHistory ?? []}
                  rubricVersions={courseData?.rubricHistory ?? []}
                />
              </div>
            </div>
          ) : (
            <StructuredProfileView
              calibration={courseData?.activeCalibration ?? null}
              rubric={courseData?.activeRubric ?? null}
              token={token}
              courseId={courseId}
              onUpdated={() => loadData(token)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
