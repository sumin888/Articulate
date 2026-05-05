'use client'

import { useState } from 'react'

type RatingItem = {
  id: string
  text: string
}

type Props = {
  label: string
  items: RatingItem[]
  scale: { min: number; max: number; labels?: Record<number, string> }
  ratings: Record<string, number>
  onChange: (ratings: Record<string, number>) => void
  onSubmit: (ratings: Record<string, number>) => void
}

export function RateItemsWidget({ label, items, scale, ratings, onChange, onSubmit }: Props) {
  function setRating(id: string, value: number) {
    onChange({ ...ratings, [id]: value })
  }

  const allRated = items.every(item => ratings[item.id] !== undefined)

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="space-y-1.5">
            <p className="text-xs text-foreground">{item.text}</p>
            <div className="flex gap-1.5">
              {Array.from({ length: scale.max - scale.min + 1 }, (_, i) => i + scale.min).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRating(item.id, v)}
                  className={`h-8 w-8 rounded-lg border text-xs font-medium transition-colors ${
                    ratings[item.id] === v
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                  title={scale.labels?.[v]}
                >
                  {v}
                </button>
              ))}
              {scale.labels && (
                <span className="ml-1 self-center text-xs text-muted-foreground">
                  {ratings[item.id] !== undefined ? scale.labels[ratings[item.id]] : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={!allRated}
        onClick={() => onSubmit(ratings)}
        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit ratings
      </button>
    </div>
  )
}
