'use client'

import { useState } from 'react'
import { SliderWidget } from './SliderWidget'
import { MultiSelectWidget } from './MultiSelectWidget'
import { RateItemsWidget } from './RateItemsWidget'
import { FreeTextWidget } from './FreeTextWidget'

export type WidgetPayload = {
  type: 'widget'
  request_id: string
  field: string
  widget_type: 'slider' | 'multi_select' | 'rate_items' | 'free_text'
  widget_config: Record<string, unknown>
}

type Props = {
  payload: WidgetPayload
  onResponse: (requestId: string, field: string, value: unknown) => void
}

export function WidgetRenderer({ payload, onResponse }: Props) {
  const [sliderValue, setSliderValue] = useState<number>(() => {
    const cfg = payload.widget_config
    return typeof cfg.defaultValue === 'number' ? cfg.defaultValue : ((cfg.min as number ?? 0) + (cfg.max as number ?? 1)) / 2
  })
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const [ratingValues, setRatingValues] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-card/50 p-3 text-xs text-muted-foreground">
        Response submitted for <span className="font-medium">{payload.field}</span>.
      </div>
    )
  }

  const cfg = payload.widget_config

  function submit(value: unknown) {
    setSubmitted(true)
    onResponse(payload.request_id, payload.field, value)
  }

  if (payload.widget_type === 'slider') {
    return (
      <SliderWidget
        label={cfg.label as string ?? payload.field}
        min={cfg.min as number ?? 0}
        max={cfg.max as number ?? 1}
        step={cfg.step as number ?? 0.1}
        value={sliderValue}
        leftLabel={cfg.leftLabel as string}
        rightLabel={cfg.rightLabel as string}
        onChange={setSliderValue}
        onSubmit={submit}
      />
    )
  }

  if (payload.widget_type === 'multi_select') {
    return (
      <MultiSelectWidget
        label={cfg.label as string ?? payload.field}
        options={cfg.options as { value: string; label: string }[] ?? []}
        selected={multiSelected}
        minSelect={cfg.minSelect as number ?? 1}
        maxSelect={cfg.maxSelect as number | undefined}
        onChange={setMultiSelected}
        onSubmit={submit}
      />
    )
  }

  if (payload.widget_type === 'rate_items') {
    return (
      <RateItemsWidget
        label={cfg.label as string ?? payload.field}
        items={cfg.items as { id: string; text: string }[] ?? []}
        scale={cfg.scale as { min: number; max: number; labels?: Record<number, string> } ?? { min: 1, max: 5 }}
        ratings={ratingValues}
        onChange={setRatingValues}
        onSubmit={submit}
      />
    )
  }

  if (payload.widget_type === 'free_text') {
    return (
      <FreeTextWidget
        label={cfg.label as string ?? payload.field}
        placeholder={cfg.placeholder as string}
        minLength={cfg.minLength as number ?? 10}
        onSubmit={submit}
      />
    )
  }

  return null
}
