import { NextRequest, NextResponse } from 'next/server'
import { getSource } from '@/lib/db'
import { retrieveFile } from '@/lib/source-ingestion'

export async function GET(req: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const source = getSource(sourceId)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (source.fileType !== 'docx') return NextResponse.json({ error: 'Only DOCX files support HTML conversion' }, { status: 400 })

  const buffer = await retrieveFile(source.redisKey)
  if (!buffer) return NextResponse.json({ error: 'File expired' }, { status: 410 })

  const mammoth = await import('mammoth')
  const result = await mammoth.convertToHtml({ buffer })

  return new NextResponse(result.value, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=3600' },
  })
}
