'use client'

import { useState } from 'react'

type Props = {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  minSelect?: number
  maxSelect?: number
  onChange: (selected: string[]) => void
  onSubmit: (selected: string[]) => void
}

export function MultiSelectWidget({ label, options, selected, minSelect = 1, maxSelect, onChange, onSubmit }: Props) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else if (!maxSelect || selected.length < maxSelect) {
      onChange([...selected, value])
    }
  }

  const canSubmit = selected.length >= minSelect

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {maxSelect && <p className="text-xs text-muted-foreground">Select up to {maxSelect}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected.includes(opt.value)
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(selected)}
        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </div>
  )
}
