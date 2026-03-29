'use client'

import { useState, useEffect, useRef } from 'react'

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
    <div className="border border-blue-300 rounded-lg p-4 bg-blue-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-600 text-sm font-medium">Written input required</span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{prompt}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Type your answer here. For math, use LaTeX notation: e.g. i\hbar \frac{\partial \psi}{\partial t} = \hat{H}\psi"
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.metaKey) handleSubmit(e)
          }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">⌘↵ to submit</span>
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  )
}
