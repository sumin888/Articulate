import { NextRequest, NextResponse } from 'next/server'
import { getSource } from '@/lib/db'
import { retrieveFile } from '@/lib/source-ingestion'

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const source = getSource(sourceId)
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

  const buffer = await retrieveFile(source.redisKey)
  if (!buffer) return NextResponse.json({ error: 'File no longer available (expired after 30 days)' }, { status: 410 })

  const mimeType = MIME_TYPES[source.fileType] ?? 'application/octet-stream'
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(source.filename)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
