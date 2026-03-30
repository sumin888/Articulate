'use client'

import { History } from 'lucide-react'

type Props = {
  currentSessionId: string
}

/** Placeholder sessions — visual only; not wired to storage. */
const PLACEHOLDER_SESSIONS = [
  { title: 'Quantum mechanics — Lecture 4', date: 'Mar 28', id: 'sample-a' },
  { title: 'Complexity: P vs NP', date: 'Mar 27', id: 'sample-b' },
  { title: 'Operating systems — paging', date: 'Mar 25', id: 'sample-c' },
  { title: 'Linear algebra — eigenvalues', date: 'Mar 22', id: 'sample-d' },
]

export function SessionHistoryRail({ currentSessionId }: Props) {
  const shortId =
    currentSessionId.length > 10
      ? `${currentSessionId.slice(0, 6)}…${currentSessionId.slice(-4)}`
      : currentSessionId

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-border bg-card/30">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Previous sessions
        </h2>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="Session history (preview)">
        <div
          className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-left shadow-sm"
          aria-current="page"
        >
          <p className="text-xs font-semibold text-foreground">This session</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{shortId}</p>
          <p className="mt-1 text-[11px] text-primary">In progress</p>
        </div>

        {PLACEHOLDER_SESSIONS.map(item => (
          <button
            key={item.id}
            type="button"
            disabled
            className="w-full rounded-xl border border-transparent px-3 py-2.5 text-left opacity-50 transition-colors hover:border-border hover:bg-muted/40 disabled:cursor-not-allowed"
          >
            <p className="text-xs font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.date}</p>
          </button>
        ))}
      </nav>

      <p className="shrink-0 border-t border-border px-3 py-2 text-[10px] leading-snug text-muted-foreground">
        History will link to past runs in a future update.
      </p>
    </aside>
  )
}
