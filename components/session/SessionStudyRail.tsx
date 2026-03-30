'use client'

import { useState } from 'react'
import { Layers, StickyNote } from 'lucide-react'

type Tab = 'notes' | 'flashcards'

export function SessionStudyRail() {
  const [tab, setTab] = useState<Tab>('notes')

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-border bg-card/30">
      <div className="flex shrink-0 border-b border-border p-1.5">
        <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setTab('notes')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
              tab === 'notes'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            Notes
          </button>
          <button
            type="button"
            onClick={() => setTab('flashcards')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
              tab === 'flashcards'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Flashcards
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'notes' && (
          <div className="flex h-full min-h-[12rem] flex-col gap-2">
            <label htmlFor="session-notes" className="text-xs font-medium text-muted-foreground">
              Your session notes
            </label>
            <textarea
              id="session-notes"
              placeholder="Jot down definitions, gaps, or follow-ups while you practice…"
              rows={12}
              className="min-h-[10rem] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">
              Notes stay in this tab for now — saving across devices comes later.
            </p>
          </div>
        )}

        {tab === 'flashcards' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Quick-review cards for this session (preview layout).
            </p>

            <div className="space-y-2">
              <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Front
                </p>
                <p className="mt-1 text-sm text-foreground">What does the Hamiltonian represent here?</p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Back
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Total energy — kinetic plus potential.</p>
              </article>

              <article className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Front
                </p>
                <p className="mt-1 text-sm text-foreground/80">Add a card from your notes…</p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Back
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Answer or hint will go here.</p>
              </article>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
