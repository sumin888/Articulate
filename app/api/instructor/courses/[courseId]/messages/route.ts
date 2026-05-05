/**
 * Stub conversational backend for the instructor calibration surface.
 * Accepts chat messages and file uploads; routes files through the ingestion pipeline.
 * The calibration agent will replace this handler in the follow-up ticket.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyInstructorToken, instructorUnauthorized } from '@/lib/auth'
import { getCourse } from '@/lib/db'
import { ingestFile } from '@/lib/source-ingestion'

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  if (!verifyInstructorToken(req)) return instructorUnauthorized()
  const { courseId } = await params

  const course = getCourse(courseId)
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''

  // File upload via multipart
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file in upload' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const fileType = (['pdf', 'docx', 'pptx'] as const).find(t => t === ext)
    if (!fileType) return NextResponse.json({
      reply: `I can't process **${file.name}** — please upload a PDF, DOCX, or PPTX file.`,
    })

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await ingestFile(courseId, buffer, file.name, fileType)
      return NextResponse.json({
        reply: `I've ingested **${file.name}**: extracted ${result.chunks.length} chunks and identified ${result.conceptCount} concepts. I'll use this material to calibrate the session.`,
        sourceId: result.source.id,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ reply: `There was a problem processing that file: ${msg}` })
    }
  }

  // Text message
  const { message } = await req.json() as { message: string }
  if (!message?.trim()) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  // Stub: acknowledge and describe what the agent will do when wired in
  return NextResponse.json({
    reply: `Got it. Once the calibration agent is connected, it will analyze your course sources and draft a complete calibration profile before asking you any questions. For now, you can review and edit the profile directly in the panel on the right.`,
  })
}
