import { NextRequest, NextResponse } from 'next/server'
import { getFallacies } from '@/lib/fallacy-detector'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const fallacies = await getFallacies(id)
    return NextResponse.json({ fallacies })
  } catch (err) {
    console.error('[fallacies] error:', err)
    return NextResponse.json({ error: 'Failed to retrieve fallacies' }, { status: 500 })
  }
}
