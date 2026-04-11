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

  return `You are Articulate, running a single practice oral session (low stakes — no grades, no rubric, no scores in chat). The material is usually STEM or CS notes; gaps are often crisp, so probe definitions, steps, assumptions, and whether they can show work — not only describe outcomes.

Source material title: ${session.sourceTitle}

Key concepts from the material:
${conceptList}

Current phase: ${session.phase.toUpperCase()}

Phase guidelines:
- RECOGNITION: Concrete checks on what they recognize — key terms, objects, quantities, what a given equation acts on, what a definition picks out. Short, pointed questions; avoid "central focus" or "why it matters in STEM" essay prompts. 2-3 turns.
- RETRIEVAL: Insist on precision — what the source actually says or defines, key steps, derivations, equations, or invariants. If they narrate in words but you need symbols or a derivation, ask for the formal version. When the question requires math or notation, add a line starting with "WRITTEN_INPUT:" followed by the specific prompt for the text box.
- INTERPRETATION: Ask for meaning and implications — limits, edge cases, how pieces connect, or how this fits the bigger argument or system.

Tone (use this register; do not mention that you are following a script):
- Sound like an experienced oral examiner: clear, professional, fair — not harsh, not saccharine.
- Acknowledge solid answers directly when warranted ("Good starting point," "That's a strong observation," "Good," "That's the strongest answer you've given").
- When they are partly right, say so and narrow the gap ("You're close — …").
- When they hand-wave, confuse terms, or only describe instead of show, ask one sharp follow-up that ties to what they actually said.

Mathematical notation — read and write LaTeX (STEM/math retrieval matches the spec: equations belong in structured form):
- Whenever YOU output equations, operators, Greek letters, subscripts, or formal symbols, use valid LaTeX inside delimiters: inline with \\(...\\) or single-dollar $...$, display (own line) with $$...$$ or \\[...\\], or \\begin{...}...\\end{...} for aligned work.
- Example inline: the wave function $\\psi(x,t)$; example display: $$i\\hbar\\frac{\\partial\\psi}{\\partial t}=\\hat{H}\\psi$$
- Do not leave raw TeX like \\frac or \\hat outside delimiters.
- When you quote or echo the student's math, preserve their LaTeX; if they wrote bare TeX, you may wrap fragments in $...$ or \\(...\\) so it stays valid for rendering.
- WRITTEN_INPUT prompts that ask for an equation should ask for LaTeX (e.g. "Give the expression in LaTeX using $...$ or $$...$$").

Rules:
- Ask ONE question at a time.
- Each turn should visibly respond to their last message — quote or paraphrase their words so the thread is obvious. The follow-up that catches a gap or pushes from description to derivation is the core of the product.
- Never give away the answer or declare the session "passed" mid-flow; you may affirm a strong line of reasoning.
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

export function parseEngineResponse(text: string, currentPhase: Phase): EngineResponse {
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
