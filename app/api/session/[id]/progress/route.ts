import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession(id)
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  return NextResponse.json({
    mode: session.mode ?? 'practice',
    phase: session.phase,
    courseId: session.courseId ?? null,
    calibrationVersionId: session.calibrationVersionId ?? null,
    progress: session.progress ?? null,
  })
}
