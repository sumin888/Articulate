'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Phase } from '@/lib/session-store'
import type { ProgressState } from '@/lib/progress-evaluator'

type Props = {
  phase: Phase
  progress: ProgressState | null
}

const PHASES: { key: string; label: string }[] = [
  { key: 'introduction', label: 'Intro' },
  { key: 'recognition', label: 'Recognition' },
  { key: 'retrieval', label: 'Retrieval' },
  { key: 'interpretation', label: 'Interpretation' },
  { key: 'evaluation', label: 'Evaluation' },
]

function phaseIndex(phase: Phase): number {
  const map: Record<Phase, number> = { recognition: 1, retrieval: 2, interpretation: 3, complete: 4 }
  return map[phase] ?? 0
}

export function ProgressBars({ phase, progress }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Weakness bar — always shown in collapsed state
  const weakest = progress?.dimensionScores.find(d => d.dimensionId === progress.weakestDimensionId)
  const weakestScore = weakest ? ((weakest.score - 1) / 3) : 0  // normalize 1–4 → 0–1

  return (
    <div className="border-b border-border bg-card/40 backdrop-blur-sm">
      {/* Collapsed: weakness bar only */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-2"
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {weakest ? `Working on: ${weakest.dimensionName}` : 'Rubric progress'}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(weakestScore * 100)}%</span>
          </div>
          <ProgressBar value={weakestScore} color="primary" />
        </div>
        <button type="button" className="shrink-0 text-muted-foreground" aria-label={expanded ? 'Collapse progress' : 'Expand progress'}>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded: all four bars */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* 1. Coverage */}
          <BarRow
            label="Coverage"
            sublabel={`${progress?.touchedConceptIds.length ?? 0} / ${progress?.totalConceptCount ?? 0} concepts`}
            value={progress && progress.totalConceptCount > 0 ? progress.touchedConceptIds.length / progress.totalConceptCount : 0}
            color="secondary"
          />

          {/* 2. Rubric mastery */}
          <RubricMasteryBar scores={progress?.dimensionScores ?? []} />

          {/* 3. Phase progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Phase Progress</span>
            </div>
            <div className="flex gap-1">
              {PHASES.map((p, i) => (
                <div
                  key={p.key}
                  className={`flex-1 rounded-sm h-1.5 transition-colors ${
                    i <= phaseIndex(phase) ? 'bg-primary' : 'bg-muted'
                  }`}
                  title={p.label}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {PHASES.map(p => <span key={p.key} className="flex-1 text-center">{p.label}</span>)}
            </div>
          </div>

          {/* 4. Weakness-targeted */}
          {weakest && (
            <BarRow
              label={`Working on: ${weakest.dimensionName}`}
              sublabel={`Score: ${weakest.score.toFixed(1)} / 4`}
              value={weakestScore}
              color="primary"
            />
          )}
        </div>
      )}
    </div>
  )
}

function BarRow({ label, sublabel, value, color }: { label: string; sublabel?: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
      </div>
      <ProgressBar value={value} color={color} />
    </div>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-500 bg-${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function RubricMasteryBar({ scores }: { scores: { dimensionId: string; dimensionName: string; score: number; weight: number }[] }) {
  const active = scores.filter(d => d.weight > 0)
  const weighted = active.reduce((acc, d) => acc + ((d.score - 1) / 3) * d.weight, 0)
  const totalWeight = active.reduce((acc, d) => acc + d.weight, 0)
  const avg = totalWeight > 0 ? weighted / totalWeight : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Rubric Mastery</span>
        <div className="group relative">
          <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">{Math.round(avg * 100)}%</span>
          {active.length > 0 && (
            <div className="absolute right-0 top-5 z-10 hidden w-48 rounded-lg border border-border bg-card p-2 shadow-lg group-hover:block">
              {active.map(d => (
                <div key={d.dimensionId} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-foreground truncate">{d.dimensionName}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{d.score.toFixed(1)}/4</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ProgressBar value={avg} color="accent" />
    </div>
  )
}
