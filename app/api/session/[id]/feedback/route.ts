import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30
import { getSession, updateSession } from '@/lib/session-store'
import { generateFeedback } from '@/lib/feedback-generator'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession(id)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Return cached feedback if already generated
    if (session.feedback) {
      return NextResponse.json({ feedback: session.feedback })
    }

    const feedback = await generateFeedback(session)
    await updateSession(id, { feedback, phase: 'complete' })

    return NextResponse.json({ feedback })
  } catch (err) {
    console.error('Feedback error:', err)
    return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(id)

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    feedback: session.feedback ?? null,
    sourceTitle: session.sourceTitle,
    history: session.conversationHistory,
    phase: session.phase,
  })
}
