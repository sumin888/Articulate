import { NextRequest, NextResponse } from 'next/server'
import { getSource } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const source = getSource(sourceId)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ sourceId: source.id, filename: source.filename, fileType: source.fileType })
}
