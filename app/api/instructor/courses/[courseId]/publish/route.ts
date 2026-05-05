import { NextRequest, NextResponse } from 'next/server'
import { verifyInstructorToken, instructorUnauthorized } from '@/lib/auth'
import { getCourse } from '@/lib/db'
import { publish_calibration_version } from '@/lib/instructor-tools'

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const { courseId } = await params

  const course = getCourse(courseId)
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  try {
    const versionId = publish_calibration_version(courseId)
    return NextResponse.json({ versionId, message: 'Calibration published. New sessions will use this version.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
