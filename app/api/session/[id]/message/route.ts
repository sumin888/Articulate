import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30
import { getSession, updateSession } from '@/lib/session-store'
import { processStudentResponse } from '@/lib/session-engine'
import { detectFallacyFireAndForget } from '@/lib/fallacy-detector'
import {
  retrieveRelevantChunks,
  buildChunkContext,
  CITE_SOURCES_TOOL,
  parseCitationsFromToolCall,
  verifyCitations,
} from '@/lib/citation'
import { evaluateProgressFireAndForget } from '@/lib/progress-evaluator'

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

    // Determine if this is a course-linked practice session
    const isPractice = (session.mode ?? 'practice') === 'practice' && !!session.courseId && !!session.calibrationVersionId

    // Add student message to history
    const updatedHistory = [
      ...session.conversationHistory,
      { role: 'student' as const, content: message },
    ]
    await updateSession(id, { conversationHistory: updatedHistory })

    const turnNumber = updatedHistory.filter(m => m.role === 'student').length
    detectFallacyFireAndForget(id, turnNumber, message)

    const currentSession = (await getSession(id))!
    const result = await processStudentResponse(currentSession, message)

    if (!result.message) {
      return NextResponse.json({ error: 'Model returned empty response' }, { status: 500 })
    }

    // ── Citation pipeline (practice + course-linked only) ──────────────────────
    let retrievedChunkIds: string[] = []
    let verifiedCitations: Awaited<ReturnType<typeof verifyCitations>> = []

    if (isPractice) {
      try {
        const chunks = await retrieveRelevantChunks(session.courseId!, message, 5)
        retrievedChunkIds = chunks.map(c => c.chunkId)

        // Run a second LLM call with cite_sources tool to get citations for the response
        const { createChatCompletion } = await import('@/lib/chat-completion')
        const citationResponse = await createChatCompletion({
          max_tokens: 200,
          tools: [CITE_SOURCES_TOOL],
          tool_choice: 'auto',
          messages: [
            {
              role: 'system',
              content: `You are identifying which phrases in a given response are grounded in source chunks. Call cite_sources for any grounded phrases.\n\nSource chunks:\n${buildChunkContext(chunks)}`,
            },
            { role: 'user', content: `Response to annotate:\n"${result.message}"` },
          ],
        })

        const rawCitations = parseCitationsFromToolCall(
          (citationResponse.choices[0]?.message as { tool_calls?: { function: { name: string; arguments: string } }[] })?.tool_calls
        )
        verifiedCitations = await verifyCitations(rawCitations)
      } catch {
        // Citation pipeline failure is non-fatal
      }
    }

    // Assemble articulate message with citations
    const articulateMessage = {
      role: 'articulate' as const,
      content: result.message,
      isWrittenInput: result.requestsWrittenInput,
      ...(verifiedCitations.length > 0 && {
        citations: verifiedCitations.map(c => ({
          phrase: c.phrase,
          chunkId: c.chunkId,
          confidence: c.confidence,
          sourceId: c.sourceId,
          pageNumber: c.pageNumber,
          slideNumber: c.slideNumber,
          paragraphIndex: c.paragraphIndex,
        })),
      }),
    }

    const finalHistory = [...currentSession.conversationHistory, articulateMessage]

    await updateSession(id, {
      conversationHistory: finalHistory,
      phase: result.newPhase,
      turnsInPhase: result.phaseAdvanced ? 0 : currentSession.turnsInPhase + 1,
    })

    // ── Async progress evaluation (practice + course-linked only) ──────────────
    if (isPractice && currentSession.calibrationVersionId) {
      const currentProgress = currentSession.progress ?? { touchedConceptIds: [], totalConceptCount: 0, dimensionScores: [], weakestDimensionId: null, updatedAt: Date.now() }
      evaluateProgressFireAndForget(
        id,
        message,
        result.message,
        currentSession.calibrationVersionId,
        retrievedChunkIds,
        session.courseId!,
        async (progress) => { await updateSession(id, { progress }) },
        currentProgress
      )
    }

    return NextResponse.json({
      message: result.message,
      requestsWrittenInput: result.requestsWrittenInput,
      writtenInputPrompt: result.writtenInputPrompt,
      phase: result.newPhase,
      sessionComplete: result.sessionComplete,
      citations: verifiedCitations.length > 0 ? verifiedCitations : undefined,
    })
  } catch (err) {
    console.error('Message error:', err)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}
