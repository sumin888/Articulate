import { NextRequest, NextResponse } from 'next/server'
import { verifyInstructorToken, instructorUnauthorized } from '@/lib/auth'
import { getCourse } from '@/lib/db'
import { update_calibration_profile } from '@/lib/instructor-tools'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const { courseId } = await params

  const course = getCourse(courseId)
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const { field, value, rationale } = await req.json() as { field: string; value: unknown; rationale?: string }
  if (!field) return NextResponse.json({ error: 'field is required' }, { status: 400 })

  try {
    const updated = await update_calibration_profile(courseId, field, value, rationale ?? 'Instructor direct edit', 'instructor')
    return NextResponse.json({ calibration: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
