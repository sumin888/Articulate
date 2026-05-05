'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'
import { Plus } from 'lucide-react'

type Course = { id: string; name: string; createdAt: number }

export default function InstructorDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('instructor_token') ?? ''
    setToken(saved)
    if (saved) loadCourses(saved)
  }, [])

  async function loadCourses(tok: string) {
    const res = await fetch('/api/instructor/courses', { headers: { Authorization: `Bearer ${tok}` } })
    if (res.ok) {
      const data = await res.json() as { courses: Course[] }
      setCourses(data.courses)
    } else {
      setError('Invalid instructor token.')
    }
  }

  async function createCourse() {
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/instructor/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const data = await res.json() as { course: Course }
      setCourses(c => [data.course, ...c])
      setNewName('')
    } else {
      setError('Could not create course.')
    }
    setCreating(false)
  }

  function saveToken(tok: string) {
    setToken(tok)
    localStorage.setItem('instructor_token', tok)
    loadCourses(tok)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <ArticulateLogo href="/" size="sm" />
        <span className="text-sm font-medium text-muted-foreground">Instructor Dashboard</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        {/* Token input */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-medium">Instructor token</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste INSTRUCTOR_TOKEN…"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => saveToken(token)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Connect
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Create course */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-medium">Create course</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCourse()}
              placeholder="Course name…"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={createCourse}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
        </div>

        {/* Course list */}
        {courses.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Your courses</p>
            {courses.map(course => (
              <Link
                key={course.id}
                href={`/instructor/${course.id}`}
                className="block rounded-xl border border-border bg-card px-5 py-4 hover:border-primary/50 transition-colors"
              >
                <p className="font-medium text-foreground">{course.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {new Date(course.createdAt * 1000).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
