'use client'

import { useState, useEffect, useRef } from 'react'
import { MathText } from '@/components/MathText'

type Props = {
  prompt: string
  onSubmit: (value: string) => void
  disabled?: boolean
}

export default function MathInput({ prompt, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <div className="border border-accent/40 rounded-2xl p-4 bg-accent/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-accent text-sm font-medium">Written input required</span>
      </div>
      <div className="mb-3 text-sm text-foreground">
        <MathText>{prompt}</MathText>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Type your answer. For math, use LaTeX in delimiters — inline: $i\hbar\frac{\partial\psi}{\partial t}=\hat{H}\psi$ or display: $$E=mc^2$$"
          rows={3}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.metaKey) handleSubmit(e)
          }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">⌘↵ to submit</span>
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  )
}
