/** Heuristics: when true, we require a probing follow-up and block phase/session advance for this turn. */

const GENERIC_ANSWER = /^(yes|no|yeah|yep|nope|nah|ok|okay|sure|idk|i\s*don'?t\s*know|dunno|not\s*sure|maybe|perhaps|sorta|sort\s+of|kinda|kind\s+of|somewhat|i\s*guess|idc|n\/a|na|none|nothing|i\s*forgot|no\s*idea)\.?$/i

const STOPWORDS = new Set(
  [
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out',
    'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way',
    'who', 'did', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'this', 'with', 'have', 'from',
    'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here',
    'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were',
    'what', 'why', 'does', 'didn', 'don', 'isn', 'won', 'had', 'being', 'also', 'only', 'even',
    'then', 'than', 'into', 'more', 'most', 'other', 'about', 'after', 'before', 'between', 'both',
  ]
)

function looksLikeMathOrFormal(s: string): boolean {
  return /\\[a-zA-Z]+/.test(s) || /\$[^$\n]+\$/.test(s) || (/\d/.test(s) && /[=+\-*/^_]/.test(s))
}

export function needsProbingFollowUp(studentMessage: string): boolean {
  const t = studentMessage.trim()
  if (!t) return false

  if (GENERIC_ANSWER.test(t)) return true

  if (looksLikeMathOrFormal(t) && t.length >= 16) return false

  const words = t.split(/\s+/).filter(Boolean)
  if (words.length <= 3 && t.length < 50) return true
  if (words.length < 6 && t.length < 40) return true

  return false
}

/**
 * True if the model reply appears to build on the student's wording (shared non-trivial tokens).
 * If the student gave no anchor words (e.g. "yes"), returns true so we do not spin on retry.
 */
export function modelResponseReferencesStudent(studentMessage: string, modelReply: string): boolean {
  const tokens = studentMessage.toLowerCase().match(/[a-z]{3,}/g) ?? []
  const significant = tokens.filter(w => !STOPWORDS.has(w))
  if (significant.length === 0) return true

  const lower = modelReply.toLowerCase()
  return significant.some(w => lower.includes(w))
}

export const MANDATORY_PROBE_INSTRUCTION = `[System — mandatory follow-up]
The student's last answer is too thin, evasive, or generic to treat as a completed turn.
You MUST ask exactly ONE follow-up question that:
- quotes or clearly paraphrases something specific from their last message (if they only wrote a few words, name that and ask what they mean concretely), and
- presses on a gap, ambiguity, or missing reasoning — not a restatement of your previous question.

Do NOT output PHASE_COMPLETE or SESSION_COMPLETE on this turn. Stay in the current phase.`

export const TIE_BACK_RETRY_INSTRUCTION = `[System]
Your last reply did not clearly connect to the student's words. Ask ONE new follow-up that explicitly echoes a phrase or idea from their last message (or acknowledges how little they wrote and asks for a concrete example or step). Still do NOT output PHASE_COMPLETE or SESSION_COMPLETE.`
