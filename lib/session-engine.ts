import {
  MANDATORY_PROBE_INSTRUCTION,
  TIE_BACK_RETRY_INSTRUCTION,
  modelResponseReferencesStudent,
  needsProbingFollowUp,
} from './adaptive-follow-up'
import { createChatCompletion } from './chat-completion'
import { SessionState, Phase } from './session-store'

const PHASE_LIMITS: Record<Phase, number> = {
  recognition: 3,
  retrieval: 3,
  interpretation: 3,
  complete: 0,
}

const NEXT_PHASE: Record<Phase, Phase> = {
  recognition: 'retrieval',
  retrieval: 'interpretation',
  interpretation: 'complete',
  complete: 'complete',
}

function buildSystemPrompt(session: SessionState): string {
  const conceptList = session.concepts
    .map(c => `- ${c.name}: ${c.definition}`)
    .join('\n')

  return `You are Articulate, a Socratic oral examiner. Your job is to assess whether a student genuinely understands their study material — not just whether they can recall facts.

Source material title: ${session.sourceTitle}

Key concepts from the material:
${conceptList}

Current phase: ${session.phase.toUpperCase()}

Phase guidelines:
- RECOGNITION: Broad questions that confirm the student knows what they're looking at. Fast, baseline. 2-3 turns.
- RETRIEVAL: Ask the student to reproduce — write definitions precisely, show derivations, state equations. When the question requires math or formal notation, add a line starting with "WRITTEN_INPUT:" followed by the specific prompt for the text box.
- INTERPRETATION: Push for meaning. What does it imply? Where does it break down? How does it connect to something outside the material? This is the hardest phase.

Rules:
- Ask ONE question at a time.
- Respond directly to what the student said — catch gaps, push on vague answers.
- Never give away the answer or confirm correctness mid-session.
- In practice mode: you can backtrack, offer a different angle, scaffold gently.
- When a phase is complete, output exactly: PHASE_COMPLETE on its own line, then the first question of the next phase.
- When interpretation is complete, output exactly: SESSION_COMPLETE on its own line.`
}

export type EngineResponse = {
  message: string
  requestsWrittenInput: boolean
  writtenInputPrompt?: string
  phaseAdvanced: boolean
  newPhase: Phase
  sessionComplete: boolean
}

export async function generateOpeningQuestion(session: SessionState): Promise<EngineResponse> {
  const response = await createChatCompletion({
    max_tokens: 400,
    messages: [
      { role: 'system', content: buildSystemPrompt(session) },
      { role: 'user', content: 'Begin the session. Generate the opening Recognition question.' },
    ],
  })

  const text = response.choices[0]?.message?.content ?? ''
  return parseEngineResponse(text, session.phase)
}

function clampProbeTurn(parsed: EngineResponse, currentPhase: Phase): EngineResponse {
  return {
    ...parsed,
    phaseAdvanced: false,
    sessionComplete: false,
    newPhase: currentPhase,
  }
}

export async function processStudentResponse(
  session: SessionState,
  studentMessage: string
): Promise<EngineResponse> {
  const requireProbe = needsProbingFollowUp(studentMessage)
  // Thin answers need a real follow-up first — do not wrap the phase on the same turn.
  const atLimit =
    !requireProbe &&
    session.turnsInPhase >= PHASE_LIMITS[session.phase] &&
    session.phase !== 'complete'

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: buildSystemPrompt(session) },
  ]

  for (const msg of session.conversationHistory) {
    messages.push({
      role: msg.role === 'articulate' ? 'assistant' : 'user',
      content: msg.content,
    })
  }

  messages.push({ role: 'user', content: studentMessage })

  if (requireProbe) {
    messages.push({ role: 'user', content: MANDATORY_PROBE_INSTRUCTION })
  }

  if (atLimit) {
    messages.push({
      role: 'user',
      content: `[System: The student has completed enough turns in the ${session.phase} phase. Wrap up this phase and advance.]`,
    })
  }

  async function runPass(): Promise<EngineResponse> {
    const response = await createChatCompletion({
      max_tokens: 500,
      messages,
    })
    const text = response.choices[0]?.message?.content ?? ''
    return parseEngineResponse(text, session.phase)
  }

  let result = await runPass()

  if (requireProbe) {
    result = clampProbeTurn(result, session.phase)

    if (!modelResponseReferencesStudent(studentMessage, result.message)) {
      messages.push({ role: 'assistant', content: result.message })
      messages.push({ role: 'user', content: TIE_BACK_RETRY_INSTRUCTION })
      result = await runPass()
      result = clampProbeTurn(result, session.phase)
    }
  }

  return result
}

function parseEngineResponse(text: string, currentPhase: Phase): EngineResponse {
  const sessionComplete = text.includes('SESSION_COMPLETE')
  const phaseAdvanced = text.includes('PHASE_COMPLETE')

  // Clean control tokens from visible message
  let message = text
    .replace(/PHASE_COMPLETE\s*/g, '')
    .replace(/SESSION_COMPLETE\s*/g, '')
    .trim()

  // Extract WRITTEN_INPUT prompt if present
  let requestsWrittenInput = false
  let writtenInputPrompt: string | undefined

  const writtenInputMatch = message.match(/WRITTEN_INPUT:\s*(.+)/i)
  if (writtenInputMatch) {
    requestsWrittenInput = true
    writtenInputPrompt = writtenInputMatch[1].trim()
    message = message.replace(/WRITTEN_INPUT:\s*.+/i, '').trim()
  }

  const newPhase: Phase = sessionComplete
    ? 'complete'
    : phaseAdvanced
    ? NEXT_PHASE[currentPhase]
    : currentPhase

  return {
    message,
    requestsWrittenInput,
    writtenInputPrompt,
    phaseAdvanced,
    newPhase,
    sessionComplete,
  }
}
