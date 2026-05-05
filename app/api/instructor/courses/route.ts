import { NextRequest, NextResponse } from 'next/server'
import { verifyInstructorToken, instructorUnauthorized } from '@/lib/auth'
import { createCourse, listCourses } from '@/lib/db'

export async function GET(req: NextRequest) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const courses = listCourses()
  return NextResponse.json({ courses })
}

export async function POST(req: NextRequest) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return NextResponse.json({ error: 'Course name is required' }, { status: 400 })

  const course = createCourse(name.trim())

  // Seed with Stanford oral comm rubric and default calibration
  const { createRubricVersion, createCalibrationVersion } = await import('@/lib/db')
  const { STANFORD_ORAL_COMM } = await import('@/lib/rubric-templates')
  const rubric = createRubricVersion(course.id, 'template', STANFORD_ORAL_COMM.dimensions, STANFORD_ORAL_COMM.origin, 'stanford_oral_comm')
  createCalibrationVersion(course.id, rubric.id, {})

  return NextResponse.json({ course }, { status: 201 })
}
