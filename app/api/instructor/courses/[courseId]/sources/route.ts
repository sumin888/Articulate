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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const filename = file.name
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const fileType = (['pdf', 'docx', 'pptx'] as const).find(t => t === ext)
  if (!fileType) return NextResponse.json({ error: 'Unsupported file type. Upload PDF, DOCX, or PPTX.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await ingestFile(courseId, buffer, filename, fileType)
    return NextResponse.json({
      source: result.source,
      chunkCount: result.chunks.length,
      conceptCount: result.conceptCount,
    }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
