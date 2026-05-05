'use client'

import { useState } from 'react'

type Props = {
  label: string
  placeholder?: string
  minLength?: number
  onSubmit: (text: string) => void
}

export function FreeTextWidget({ label, placeholder = 'Your answer…', minLength = 10, onSubmit }: Props) {
  const [text, setText] = useState('')
  const canSubmit = text.trim().length >= minLength

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{text.trim().length} chars</span>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onSubmit(text.trim())}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </div>
    </div>
  )
}
