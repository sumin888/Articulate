'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArticulateLogo } from '@/components/ArticulateLogo'

type Block = { id: string; text: string; isDistractor: boolean }
type BlocksData = { topic: string; correctSentence: string; blocks: Block[] }

export default function BlocksPage() {
  const [topic, setTopic] = useState('')
  const [data, setData] = useState<BlocksData | null>(null)
  const [arranged, setArranged] = useState<Block[]>([])
  const [pool, setPool] = useState<Block[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [dragSource, setDragSource] = useState<{ area: 'pool' | 'arranged'; index: number } | null>(null)
  const difficulty = Math.min(Math.ceil(score / 2) + 1, 3)

  async function generate(diff = difficulty) {
    if (!topic.trim() || loading) return
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/reflect/blocks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty: diff }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setData(d)
      setPool([...d.blocks])
      setArranged([])
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to generate blocks. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function moveToArranged(block: Block, poolIndex: number) {
    setPool(p => p.filter((_, i) => i !== poolIndex))
    setArranged(a => [...a, block])
    setResult(null)
  }

  function moveToPool(block: Block, arrangedIndex: number) {
    setArranged(a => a.filter((_, i) => i !== arrangedIndex))
    setPool(p => [...p, block])
    setResult(null)
  }

  function handleDragStart(area: 'pool' | 'arranged', index: number) {
    setDragSource({ area, index })
  }

  function handleDropOnArranged(targetIndex: number) {
    if (!dragSource) return
    if (dragSource.area === 'pool') {
      const block = pool[dragSource.index]
      const newPool = pool.filter((_, i) => i !== dragSource.index)
      const newArranged = [...arranged]
      newArranged.splice(targetIndex, 0, block)
      setPool(newPool)
      setArranged(newArranged)
    } else {
      const newArranged = [...arranged]
      const [block] = newArranged.splice(dragSource.index, 1)
      newArranged.splice(targetIndex, 0, block)
      setArranged(newArranged)
    }
    setDragSource(null)
    setResult(null)
  }

  function handleDropOnPool() {
    if (!dragSource) return
    if (dragSource.area === 'arranged') {
      const block = arranged[dragSource.index]
      setArranged(a => a.filter((_, i) => i !== dragSource.index))
      setPool(p => [...p, block])
    }
    setDragSource(null)
    setResult(null)
  }

  function checkAnswer() {
    if (!data) return
    const arranged_non_distractor = arranged.filter(b => !b.isDistractor)
    const built = arranged.map(b => b.text).join(' ')
    const correct = data.correctSentence.trim()
    const isCorrect = built.trim() === correct || arranged_non_distractor.map(b => b.text).join(' ').trim() === correct
    setResult(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) setScore(s => s + 1)
  }

  function nextRound() {
    setRound(r => r + 1)
    generate(Math.min(Math.ceil((score + 1) / 2) + 1, 3))
  }

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

      <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">Blocks</h1>
            <p className="text-sm text-muted-foreground">Drag word blocks to build the correct sentence.</p>
          </div>
          {data && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Round {round}</p>
              <p className="text-sm font-semibold text-foreground">{score} correct</p>
            </div>
          )}
        </div>

        {!data && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <label className="block text-sm font-medium text-foreground mb-2">Topic</label>
            <div className="flex gap-2">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate(1)}
                placeholder="e.g. Photosynthesis"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => generate(1)}
                disabled={!topic.trim() || loading}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating…' : 'Start'}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">Difficulty: {'★'.repeat(difficulty)}{'☆'.repeat(3 - difficulty)}</div>

            {/* Arranged area */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDropOnArranged(arranged.length)}
              className="min-h-[60px] rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 flex flex-wrap gap-2 items-center"
            >
              {arranged.length === 0 && (
                <span className="text-sm text-muted-foreground">Drop blocks here to build your sentence</span>
              )}
              {arranged.map((block, i) => (
                <div
                  key={block.id + '-' + i}
                  draggable
                  onDragStart={() => handleDragStart('arranged', i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDropOnArranged(i)}
                  onClick={() => moveToPool(block, i)}
                  className="cursor-pointer rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-foreground select-none hover:bg-primary/20 transition-colors"
                >
                  {block.text}
                </div>
              ))}
            </div>

            {/* Pool */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropOnPool}
              className="flex flex-wrap gap-2 min-h-[44px]"
            >
              {pool.map((block, i) => (
                <div
                  key={block.id + '-' + i}
                  draggable
                  onDragStart={() => handleDragStart('pool', i)}
                  onClick={() => moveToArranged(block, i)}
                  className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground select-none hover:border-primary/40 hover:bg-muted transition-colors"
                >
                  {block.text}
                </div>
              ))}
            </div>

            {result === null && (
              <button
                type="button"
                onClick={checkAnswer}
                disabled={arranged.length === 0}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check
              </button>
            )}

            {result === 'correct' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                  Correct!
                </div>
                <button
                  type="button"
                  onClick={nextRound}
                  disabled={loading}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {loading ? 'Generating…' : 'Next round'}
                </button>
              </div>
            )}

            {result === 'incorrect' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Not quite. Correct: <span className="font-medium">{data.correctSentence}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setPool([...data.blocks]); setArranged([]); setResult(null) }}
                    className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={nextRound}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {loading ? 'Generating…' : 'Next round'}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="button"
              onClick={() => { setData(null); setScore(0); setRound(1) }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Change topic
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
