'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { RubricDimension } from '@/lib/db'

type Props = {
  dimensions: RubricDimension[]
  onChange: (dimensions: RubricDimension[]) => void
}

export function RubricEditor({ dimensions, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function updateDimension(id: string, updates: Partial<RubricDimension>) {
    onChange(dimensions.map(d => d.id === id ? { ...d, ...updates } : d))
  }

  const activeCount = dimensions.filter(d => d.active).length
  const totalWeight = dimensions.filter(d => d.active).reduce((s, d) => s + d.weight, 0)
  const weightOk = Math.abs(totalWeight - 1) < 0.01

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{activeCount} active dimensions</span>
        <span className={`text-xs font-medium ${weightOk ? 'text-primary' : 'text-destructive'}`}>
          Weights: {totalWeight.toFixed(2)} {weightOk ? '✓' : '(must sum to 1.0)'}
        </span>
      </div>

      {dimensions.map(dim => (
        <div key={dim.id} className={`rounded-xl border transition-colors ${dim.active ? 'border-border' : 'border-border/50 opacity-60'}`}>
          <div
            className="flex cursor-pointer items-center gap-3 px-4 py-3"
            onClick={() => setExpanded(e => e === dim.id ? null : dim.id)}
          >
            <input
              type="checkbox"
              checked={dim.active}
              onChange={e => { e.stopPropagation(); updateDimension(dim.id, { active: e.target.checked, weight: e.target.checked ? 0.25 : 0 }) }}
              className="h-4 w-4 accent-primary"
              onClick={e => e.stopPropagation()}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{dim.name}</p>
              <p className="text-xs text-muted-foreground truncate">{dim.description}</p>
            </div>
            {dim.active && (
              <div className="shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-muted-foreground">w:</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={dim.weight}
                  onChange={e => updateDimension(dim.id, { weight: parseFloat(e.target.value) || 0 })}
                  className="w-14 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
            <button type="button" className="shrink-0 text-muted-foreground">
              {expanded === dim.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {expanded === dim.id && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={dim.description}
                  onChange={e => updateDimension(dim.id, { description: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Proficiency levels</p>
                {dim.proficiency_levels.map((level, li) => (
                  <div key={level.level} className="flex gap-2">
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium">{level.label}</span>
                    <textarea
                      value={level.descriptor}
                      onChange={e => {
                        const updated = [...dim.proficiency_levels]
                        updated[li] = { ...updated[li], descriptor: e.target.value }
                        updateDimension(dim.id, { proficiency_levels: updated })
                      }}
                      rows={2}
                      className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
