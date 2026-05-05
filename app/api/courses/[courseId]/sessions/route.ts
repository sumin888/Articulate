import { NextRequest, NextResponse } from 'next/server'
import { getActiveCalibration, listCourseConcepts, listSources } from '@/lib/db'
import { createSession, updateSession } from '@/lib/session-store'
import { emptyProgress } from '@/lib/progress-evaluator'

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params

  const calibration = getActiveCalibration(courseId)
  if (!calibration) return NextResponse.json({ error: 'This course has no active calibration. Ask your instructor to publish a calibration first.' }, { status: 404 })

  const sources = listSources(courseId)
  if (sources.length === 0) return NextResponse.json({ error: 'This course has no source material yet.' }, { status: 404 })

  const concepts = listCourseConcepts(courseId)
  const totalConceptCount = concepts.length

  // Build opening message for the practice session
  const conceptNames = concepts.slice(0, 5).map(c => c.label).join(', ')
  const openingMessage = `Welcome! This is a practice session for your course. We'll work through the material in three phases — Recognition, Retrieval, and Interpretation. I've reviewed the course sources and identified key concepts including ${conceptNames}. This is ungraded practice, so focus on articulating clearly. Let's go.\n\nLet's start with Recognition. Can you explain what you understand by "${concepts[0]?.label ?? 'the main topic'}"?`

  // Create session pinned to current calibration version
  const session = await createSession('', `Course Session`, [])
  await updateSession(session.id, {
    conversationHistory: [{ role: 'articulate', content: openingMessage }],
    mode: 'practice',
    courseId,
    calibrationVersionId: calibration.id,
    progress: emptyProgress(totalConceptCount),
  })

  return NextResponse.json({ sessionId: session.id }, { status: 201 })
}
