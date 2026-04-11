'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

type Card = { id: string; front: string; back: string }
type Deck = { deckTitle: string; cards: Card[] }

type CardResult = 'known' | 'unknown'

export default function AnkiPage() {
  const [topic, setTopic] = useState('')
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Study state
  const [cardIndex, setCardIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<CardResult[]>([])
  const [done, setDone] = useState(false)

  async function generateDeck() {
    if (!topic.trim() || loading) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/reflect/anki/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDeck(data)
      setCardIndex(0)
      setFlipped(false)
      setResults([])
      setDone(false)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to generate deck. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function markCard(result: CardResult) {
    const newResults = [...results, result]
    setResults(newResults)
    if (deck && cardIndex + 1 >= deck.cards.length) {
      setDone(true)
    } else {
      setCardIndex(i => i + 1)
      setFlipped(false)
    }
  }

  const knownCount = results.filter(r => r === 'known').length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <ArticulateLogo href="/" size="sm" />
          <Link href="/reflect" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Reflect
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Anki</h1>
        <p className="text-sm text-muted-foreground mb-8">Generate a flashcard deck on any topic.</p>

        {!deck && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <label className="block text-sm font-medium text-foreground mb-2">Topic</label>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateDeck()}
                placeholder="e.g. Newton's laws of motion"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={generateDeck}
                disabled={!topic.trim() || loading}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {deck && !done && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{deck.deckTitle}</h2>
              <span className="text-sm text-muted-foreground">
                {cardIndex + 1} / {deck.cards.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setFlipped(f => !f)}
              className="w-full min-h-[200px] rounded-2xl border border-border bg-card p-8 text-center cursor-pointer transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">
                {flipped ? 'Answer' : 'Question'}
              </p>
              <p className="text-lg font-medium text-foreground leading-relaxed">
                {flipped ? deck.cards[cardIndex].back : deck.cards[cardIndex].front}
              </p>
              {!flipped && (
                <p className="mt-4 text-xs text-muted-foreground">Click to reveal answer</p>
              )}
            </button>

            {flipped && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => markCard('unknown')}
                  className="flex-1 rounded-xl border border-destructive/50 bg-destructive/10 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
                >
                  Still learning
                </button>
                <button
                  type="button"
                  onClick={() => markCard('known')}
                  className="flex-1 rounded-xl border border-border bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Got it
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setDeck(null); setTopic('') }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← New deck
            </button>
          </div>
        )}

        {done && deck && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <p className="text-4xl font-bold text-foreground">{knownCount}/{deck.cards.length}</p>
            <p className="text-sm text-muted-foreground">cards marked as known</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => { setCardIndex(0); setFlipped(false); setResults([]); setDone(false) }}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Review again
              </button>
              <button
                type="button"
                onClick={() => { setDeck(null); setTopic('') }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                New deck
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
