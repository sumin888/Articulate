'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Link2, ChevronRight, Sparkles } from 'lucide-react'
import { ArticulateLogo } from '@/components/ArticulateLogo'

// ── Hardcoded public-domain passages (instant, no LLM needed) ────────────────

const LIBRARY: Record<string, { workTitle: string; author: string; publicationYear: string; chapter: string; excerpt: string }> = {
  'Hamlet by Shakespeare': {
    workTitle: 'Hamlet',
    author: 'William Shakespeare',
    publicationYear: '1603',
    chapter: 'Act 3, Scene 1',
    excerpt: "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles, and by opposing end them. To die—to sleep, no more; and by a sleep to say we end the heartache and the thousand natural shocks that flesh is heir to: 'tis a consummation devoutly to be wish'd.",
  },
  'Pride and Prejudice by Jane Austen': {
    workTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    publicationYear: '1813',
    chapter: 'Chapter 1',
    excerpt: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.",
  },
  'A Tale of Two Cities by Dickens': {
    workTitle: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    publicationYear: '1859',
    chapter: 'Book 1, Chapter 1',
    excerpt: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us.",
  },
  'The Adventures of Huckleberry Finn': {
    workTitle: 'Adventures of Huckleberry Finn',
    author: 'Mark Twain',
    publicationYear: '1884',
    chapter: 'Chapter 1',
    excerpt: "You don't know about me without you have read a book by the name of The Adventures of Tom Sawyer; but that ain't no matter. That book was made by Mr. Mark Twain, and he told the truth, mainly. There was things which he stretched, but mainly he told the truth. That is nothing. I never seen anybody but lied one time or another.",
  },
  'The Iliad by Homer': {
    workTitle: 'The Iliad',
    author: 'Homer',
    publicationYear: 'c. 750 BC',
    chapter: 'Book 1',
    excerpt: "Sing, O goddess, the anger of Achilles son of Peleus, that brought countless ills upon the Achaeans. Many a brave soul did it send hurrying down to Hades, and many a hero did it yield a prey to dogs and vultures, for so were the counsels of Zeus fulfilled from the day on which the son of Atreus, king of men, and great Achilles, first fell out with one another.",
  },
  'Crime and Punishment by Dostoevsky': {
    workTitle: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    publicationYear: '1866',
    chapter: 'Part 1, Chapter 1',
    excerpt: "On an exceptionally hot evening early in July a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge. He had successfully avoided meeting his landlady on the staircase. His garret was under the roof of a high, five-storied house and was more like a cupboard than a room.",
  },
  'Frankenstein by Mary Shelley': {
    workTitle: 'Frankenstein',
    author: 'Mary Shelley',
    publicationYear: '1818',
    chapter: "Author's Introduction",
    excerpt: "I saw the pale student of unhallowed arts kneeling beside the thing he had put together. I saw the hideous phantasm of a man stretched out, and then, on the working of some powerful engine, show signs of life and stir with an uneasy, half-vital motion. Frightful must it be; for supremely frightful would be the effect of any human endeavour to mock the stupendous mechanism of the Creator of the world.",
  },
  'The Raven by Edgar Allan Poe': {
    workTitle: 'The Raven',
    author: 'Edgar Allan Poe',
    publicationYear: '1845',
    chapter: 'Stanza 1',
    excerpt: "Once upon a midnight dreary, while I pondered, weak and weary, over many a quaint and curious volume of forgotten lore— While I nodded, nearly napping, suddenly there came a tapping, as of some one gently rapping, rapping at my chamber door. \"'Tis some visitor,\" I muttered, \"tapping at my chamber door— only this and nothing more.\"",
  },
}

const SUGGESTIONS = Object.keys(LIBRARY)

// ── Types ────────────────────────────────────────────────────────────────────

type Source =
  | { kind: 'classic'; workTitle: string; author: string; publicationYear: string; excerpt: string }
  | { kind: 'url'; articleTitle: string; articleUrl: string; excerpt: string }

type Development = { order: number; description: string }
type Detail = { id: string; text: string; targetIndex: number }
type Structure = { n: number; developments: Development[]; details: Detail[] }

type Mode = 'classic' | 'url'
type Step = 'input' | 'reading' | 'developing' | 'outline-review' | 'details' | 'done'

// ── Component ────────────────────────────────────────────────────────────────

export default function WordMapPage() {
  const [mode, setMode] = useState<Mode>('classic')
  const [work, setWork] = useState(SUGGESTIONS[0])
  const [urlInput, setUrlInput] = useState('')
  const [step, setStep] = useState<Step>('input')

  // Typewriter preview on input step
  const [previewText, setPreviewText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const [source, setSource] = useState<Source | null>(null)
  const [structure, setStructure] = useState<Structure | null>(null)
  const structurePromise = useRef<Promise<Structure | null> | null>(null)

  const [userDevelopments, setUserDevelopments] = useState<string[]>([])
  const [placements, setPlacements] = useState<Record<string, number | null>>({})

  const [fetchLoading, setFetchLoading] = useState(false)
  const [structureLoading, setStructureLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // ── Typewriter effect on input step ──────────────────────────────────────

  const previewExcerpt = LIBRARY[work]?.excerpt ?? ''

  useEffect(() => {
    if (step !== 'input' || mode !== 'classic') return
    setIsTyping(true)
    setPreviewText('')
    let i = 0
    const interval = setInterval(() => {
      if (i < previewExcerpt.length) {
        setPreviewText(previewExcerpt.slice(0, i + 1))
        i++
      } else {
        setIsTyping(false)
        clearInterval(interval)
      }
    }, 18)
    return () => clearInterval(interval)
  }, [work, mode, step, previewExcerpt])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function reset() {
    setSource(null)
    setStructure(null)
    structurePromise.current = null
    setUserDevelopments([])
    setPlacements({})
    setFetchError('')
    setStep('input')
  }

  function kickStructure(excerpt: string): Promise<Structure | null> {
    const p = fetch('/api/reflect/wordmap/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excerpt }),
    })
      .then(r => r.json())
      .then((d: Structure) => { setStructure(d); return d })
      .catch(() => null)
    structurePromise.current = p
    return p
  }

  // ── Generate / fetch ──────────────────────────────────────────────────────

  async function startClassic() {
    const query = work.trim()
    if (!query || fetchLoading) return
    setFetchError('')

    // Use hardcoded library if available — instant
    if (LIBRARY[query]) {
      const lib = LIBRARY[query]
      const src: Source = { kind: 'classic', workTitle: lib.workTitle, author: lib.author, publicationYear: lib.publicationYear, excerpt: lib.excerpt }
      setSource(src)
      kickStructure(lib.excerpt)
      setStep('reading')
      return
    }

    // Custom input — call LLM
    setFetchLoading(true)
    try {
      const res = await fetch('/api/reflect/wordmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work: query }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      const src: Source = { kind: 'classic', ...d }
      setSource(src)
      kickStructure(d.excerpt)
      setStep('reading')
    } catch (err: unknown) {
      setFetchError((err as Error).message ?? 'Failed. Please try again.')
    } finally {
      setFetchLoading(false)
    }
  }

  async function startUrl() {
    const rawUrl = urlInput.trim()
    if (!rawUrl || fetchLoading) return
    setFetchError('')
    setFetchLoading(true)
    try {
      const res = await fetch('/api/reflect/wordmap/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? d.error ?? 'Failed')
      const src: Source = { kind: 'url', ...d }
      setSource(src)
      kickStructure(d.excerpt)
      setStep('reading')
    } catch (err: unknown) {
      setFetchError((err as Error).message ?? 'Could not fetch that URL.')
    } finally {
      setFetchLoading(false)
    }
  }

  async function startActivity() {
    if (!source) return
    let s = structure
    if (!s) {
      setStructureLoading(true)
      s = structurePromise.current ? await structurePromise.current : null
      setStructureLoading(false)
    }
    if (!s) { setFetchError('Failed to analyze the passage. Please try again.'); return }
    setUserDevelopments(Array(s.n).fill(''))
    setStep('developing')
  }

  function submitDevelopments() {
    if (userDevelopments.some(d => !d.trim())) return
    setStep('outline-review')
  }

  function startDetails() {
    if (!structure) return
    const initial: Record<string, number | null> = {}
    structure.details.forEach(d => { initial[d.id] = null })
    setPlacements(initial)
    setStep('details')
  }

  const detailScore = structure?.details
    ? structure.details.filter(d => placements[d.id] === d.targetIndex).length
    : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <ArticulateLogo href="/" size="sm" />
          {step !== 'input' ? (
            <button type="button" onClick={reset}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              New passage
            </button>
          ) : (
            <Link href="/reflect"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Reflect
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">

        {/* ── STEP: INPUT ── */}
        {step === 'input' && (
          <>
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="w-3 h-3" />
                  AI-Powered
                </span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-3 text-balance">WordMap</h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Read a passage and trace how its ideas unfold — step by step.
              </p>
            </div>

            <div className="grid lg:grid-cols-5 gap-8">
              {/* Left: input panel */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  {/* Tab switcher */}
                  <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6">
                    {(['classic', 'url'] as const).map(m => (
                      <button key={m} type="button" onClick={() => { setMode(m); setFetchError('') }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-all ${
                          mode === m
                            ? 'bg-card text-foreground font-medium shadow-sm border border-border'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}>
                        {m === 'classic' ? <><BookOpen className="w-4 h-4" />Classic</> : <><Link2 className="w-4 h-4" />URL</>}
                      </button>
                    ))}
                  </div>

                  {mode === 'classic' && (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <input
                          value={work}
                          onChange={e => setWork(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && startClassic()}
                          placeholder="Enter a classic work or author…"
                          className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button type="button" onClick={startClassic} disabled={!work.trim() || fetchLoading}
                          className="h-11 px-5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                          {fetchLoading ? 'Loading…' : <><span>Generate</span><ChevronRight className="w-4 h-4" /></>}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Popular works</p>
                        <div className="flex flex-wrap gap-2">
                          {SUGGESTIONS.map(s => (
                            <button key={s} type="button" onClick={() => setWork(s)}
                              className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                work === s
                                  ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                  : 'bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                              }`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === 'url' && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={urlInput}
                          onChange={e => setUrlInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && startUrl()}
                          placeholder="https://…"
                          type="url"
                          className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button type="button" onClick={startUrl} disabled={!urlInput.trim() || fetchLoading}
                          className="h-11 px-5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                          {fetchLoading ? 'Fetching…' : <><span>Fetch</span><ChevronRight className="w-4 h-4" /></>}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Works best with news articles and essays. Paywalled sites may not load.</p>
                    </div>
                  )}

                  {fetchError && <p className="mt-3 text-sm text-destructive">{fetchError}</p>}
                </div>
              </div>

              {/* Right: dark preview panel */}
              <div className="lg:col-span-3">
                <div className="rounded-2xl bg-slate-900 p-8 min-h-[320px] relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative">
                    {/* Traffic-light dots + chapter badge */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <div className="h-px flex-1 bg-white/10" />
                      {mode === 'classic' && LIBRARY[work] && (
                        <span className="text-xs border border-white/20 text-white/60 rounded-full px-2 py-0.5">
                          {LIBRARY[work].chapter}
                        </span>
                      )}
                    </div>

                    {mode === 'classic' ? (
                      <>
                        <h3 className="text-white/90 text-sm font-medium mb-4 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          {work || 'Select a work'}
                        </h3>
                        <blockquote className="text-white/80 text-base leading-relaxed font-serif italic">
                          &ldquo;{previewText}
                          {isTyping && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />}
                          {!isTyping && previewText && '\u201D'}
                        </blockquote>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-white/40 text-sm gap-3">
                        <Link2 className="w-8 h-8" />
                        Paste a URL on the left to preview the article
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── STEP: READING ── */}
        {step === 'reading' && source && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">Read the passage</h1>
              <p className="text-sm text-muted-foreground">Take your time. You'll be asked to identify how its ideas develop.</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-3">
              {source.kind === 'classic' ? (
                <>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-display text-base font-semibold text-foreground">{source.workTitle}</p>
                    <p className="text-xs text-muted-foreground shrink-0">{source.publicationYear}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{source.author} · Public domain</p>
                  <blockquote className="mt-2 border-l-2 border-primary/40 pl-4 text-sm text-foreground leading-relaxed italic">
                    {source.excerpt}
                  </blockquote>
                </>
              ) : (
                <>
                  <p className="font-display text-base font-semibold text-foreground">{source.articleTitle}</p>
                  <a href={source.articleUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline break-all">{source.articleUrl}</a>
                  <p className="mt-2 text-sm text-foreground leading-relaxed">{source.excerpt}</p>
                </>
              )}
            </div>
            <button type="button" onClick={startActivity} disabled={structureLoading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {structureLoading ? 'Preparing activity…' : "I've read it — start activity"}
            </button>
            {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}
          </div>
        )}

        {/* ── STEP: DEVELOPING ── */}
        {step === 'developing' && structure && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">
                Identify the {structure.n} main points
              </h1>
              <p className="text-sm text-muted-foreground">
                This passage covers <strong>{structure.n}</strong> main points. Describe each one briefly in your own words, in the order they appear.
              </p>
            </div>
            <div className="space-y-3">
              {userDevelopments.map((val, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="mt-3 shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <textarea value={val}
                    onChange={e => { const u = [...userDevelopments]; u[i] = e.target.value; setUserDevelopments(u) }}
                    placeholder={`Point ${i + 1}…`} rows={2}
                    className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={submitDevelopments}
              disabled={userDevelopments.some(d => !d.trim())}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Submit my outline
            </button>
          </div>
        )}

        {/* ── STEP: OUTLINE REVIEW ── */}
        {step === 'outline-review' && structure && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">Compare your outline</h1>
              <p className="text-sm text-muted-foreground">Your descriptions on the left. The fully articulated version on the right.</p>
            </div>
            <div className="space-y-4">
              {structure.developments.map((dev, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Your #{i + 1}</p>
                    <p className="text-sm text-foreground leading-relaxed">{userDevelopments[i]}</p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary/70 mb-2">Model #{i + 1}</p>
                    <p className="text-sm text-foreground leading-relaxed">{dev.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={startDetails}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Continue — place the details
            </button>
          </div>
        )}

        {/* ── STEP: DETAILS ── */}
        {step === 'details' && structure && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">Place the details</h1>
              <p className="text-sm text-muted-foreground">Assign each detail to the main point it belongs to.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your outline</p>
              {structure.developments.map((dev, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <p className="text-muted-foreground leading-snug">{dev.description}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {structure.details.map(detail => (
                <div key={detail.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm text-foreground leading-relaxed">
                    <span className="text-muted-foreground mr-1">Detail:</span>
                    &ldquo;{detail.text}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {structure.developments.map((_, i) => (
                      <button key={i} type="button"
                        onClick={() => setPlacements(prev => ({ ...prev, [detail.id]: i }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          placements[detail.id] === i
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}>
                        Point {i + 1}
                      </button>
                    ))}
                    {placements[detail.id] !== null && placements[detail.id] !== undefined && (
                      <button type="button"
                        onClick={() => setPlacements(prev => ({ ...prev, [detail.id]: null }))}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-1">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setStep('done')}
              disabled={Object.values(placements).some(v => v === null)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Submit placements
            </button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && structure && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">Results</h1>
              <p className="text-sm text-muted-foreground">
                {detailScore} of {structure.details.length} details placed correctly.
              </p>
            </div>
            <div className="space-y-3">
              {structure.details.map(detail => {
                const correct = placements[detail.id] === detail.targetIndex
                return (
                  <div key={detail.id}
                    className={`rounded-xl border p-4 space-y-1 ${correct ? 'border-green-500/30 bg-green-500/10' : 'border-destructive/30 bg-destructive/10'}`}>
                    <p className="text-sm text-foreground leading-relaxed">&ldquo;{detail.text}&rdquo;</p>
                    <p className="text-xs text-muted-foreground">
                      {correct
                        ? <span className="text-green-700 dark:text-green-400">✓ Point {detail.targetIndex + 1}</span>
                        : <><span className="text-destructive">✗ You chose point {(placements[detail.id] ?? 0) + 1}</span> · Correct: point {detail.targetIndex + 1}</>}
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={reset}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                Try another passage
              </button>
              <Link href="/reflect"
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-center text-muted-foreground hover:text-foreground transition-colors">
                Back to Reflect
              </Link>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
