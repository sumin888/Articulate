'use client'

type Props = {
  label: string
  min: number
  max: number
  step?: number
  value: number
  leftLabel?: string
  rightLabel?: string
  onChange: (value: number) => void
  onSubmit: (value: number) => void
}

export function SliderWidget({ label, min, max, step = 0.1, value, leftLabel, rightLabel, onChange, onSubmit }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{leftLabel ?? min}</span>
          <span className="font-medium text-foreground">{value.toFixed(1)}</span>
          <span>{rightLabel ?? max}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSubmit(value)}
        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Submit
      </button>
    </div>
  )
}
