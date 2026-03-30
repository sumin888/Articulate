import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/session-store'
import { processStudentResponse } from '@/lib/session-engine'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { message } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const session = await getSession(id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.phase === 'complete') {
      return NextResponse.json({ error: 'Session already complete' }, { status: 400 })
    }

    // Add student message to history
    const updatedHistory = [
      ...session.conversationHistory,
      { role: 'student' as const, content: message },
    ]
    await updateSession(id, { conversationHistory: updatedHistory })

    // Get updated session and process
    const currentSession = (await getSession(id))!
    const result = await processStudentResponse(currentSession, message)

    if (!result.message) {
      return NextResponse.json({ error: 'Model returned empty response' }, { status: 500 })
    }

    // Add articulate response to history
    const finalHistory = [
      ...currentSession.conversationHistory,
      {
        role: 'articulate' as const,
        content: result.message,
        isWrittenInput: result.requestsWrittenInput,
      },
    ]

    await updateSession(id, {
      conversationHistory: finalHistory,
      phase: result.newPhase,
      turnsInPhase: result.phaseAdvanced ? 0 : currentSession.turnsInPhase + 1,
    })

    return NextResponse.json({
      message: result.message,
      requestsWrittenInput: result.requestsWrittenInput,
      writtenInputPrompt: result.writtenInputPrompt,
      phase: result.newPhase,
      sessionComplete: result.sessionComplete,
    })
  } catch (err) {
    console.error('Message error:', err)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}
