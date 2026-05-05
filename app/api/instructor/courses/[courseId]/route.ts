import { NextRequest, NextResponse } from 'next/server'
import { verifyInstructorToken, instructorUnauthorized } from '@/lib/auth'
import {
  getCourse,
  listSources,
  listCourseConcepts,
  getActiveRubric,
  getActiveCalibration,
  listRubricVersions,
  listCalibrationVersions,
} from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const { courseId } = await params

  const course = getCourse(courseId)
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const sources = listSources(courseId)
  const concepts = listCourseConcepts(courseId)
  const activeRubric = getActiveRubric(courseId)
  const activeCalibration = getActiveCalibration(courseId)
  const rubricHistory = listRubricVersions(courseId)
  const calibrationHistory = listCalibrationVersions(courseId)

  return NextResponse.json({
    course,
    sources,
    concepts,
    activeRubric,
    activeCalibration,
    rubricHistory,
    calibrationHistory,
  })
}
