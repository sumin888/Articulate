import { describe, expect, it } from 'vitest'
import { modelResponseReferencesStudent, needsProbingFollowUp } from './adaptive-follow-up'

describe('needsProbingFollowUp', () => {
  it('returns true for very short generic answers', () => {
    expect(needsProbingFollowUp('yes')).toBe(true)
    expect(needsProbingFollowUp('idk')).toBe(true)
  })

  it('returns false for substantive mathy answers', () => {
    expect(needsProbingFollowUp(String.raw`The energy is $E = \hbar \omega (n + 1/2)$ for the oscillator.`)).toBe(
      false
    )
  })

  it('returns false for empty string', () => {
    expect(needsProbingFollowUp('')).toBe(false)
  })
})

describe('modelResponseReferencesStudent', () => {
  it('returns true when model echoes student token', () => {
    expect(
      modelResponseReferencesStudent(
        'I used the Schrödinger equation.',
        'You mentioned the Schrödinger equation — good.'
      )
    ).toBe(true)
  })

  it('returns true when student had no significant anchor words (no 3+ letter tokens)', () => {
    expect(modelResponseReferencesStudent('ok', 'Tell me more.')).toBe(true)
  })
})
