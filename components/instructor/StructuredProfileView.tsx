'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { RubricEditor } from './RubricEditor'
import type { RubricVersion, CalibrationVersion, RubricDimension, ReasoningLogEntry } from '@/lib/db'

type Props = {
  calibration: CalibrationVersion | null
  rubric: RubricVersion | null
  token: string
  courseId: string
  onUpdated: () => void
}

export function StructuredProfileView({ calibration, rubric, token, courseId, onUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [localDimensions, setLocalDimensions] = useState<RubricDimension[] | null>(null)

  const dims = localDimensions ?? rubric?.dimensions ?? []

  async function updateField(field: string, value: unknown) {
    setSaving(field)
    await fetch(`/api/instructor/courses/${courseId}/calibration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ field, value }),
    })
    setSaving(null)
    onUpdated()
  }

  async function saveRubric() {
    setSaving('rubric')
    await fetch(`/api/instructor/courses/${courseId}/rubric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'parse_text', rubricText: JSON.stringify(localDimensions) }),
    })
    setLocalDimensions(null)
    setSaving(null)
    onUpdated()
  }

  async function applyTemplate(templateId: string) {
    setSaving('template')
    await fetch(`/api/instructor/courses/${courseId}/rubric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'template', templateId }),
    })
    setSaving(null)
    onUpdated()
  }

  async function publish() {
    setSaving('publish')
    await fetch(`/api/instructor/courses/${courseId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setSaving(null)
    onUpdated()
  }

  const log = calibration?.reasoningLog ?? []

  return (
    <div className="flex h-full flex-col overflow-y-auto space-y-0">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Calibration Profile</p>
          {calibration && (
            <p className="text-xs text-muted-foreground">v{calibration.id.slice(-6)} {calibration.isActive ? '· Active' : '· Draft'}</p>
          )}
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={saving === 'publish'}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Rubric */}
        <Section title="Rubric" defaultOpen>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => applyTemplate('stanford_oral_comm')}
              disabled={!!saving}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {saving === 'template' ? 'Applying…' : 'Stanford SCALE template'}
            </button>
          </div>
          <RubricEditor
            dimensions={dims}
            onChange={d => setLocalDimensions(d)}
          />
          {localDimensions && (
            <button
              type="button"
              onClick={saveRubric}
              disabled={saving === 'rubric'}
              className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving === 'rubric' ? 'Saving…' : 'Save rubric changes'}
            </button>
          )}
        </Section>

        {/* Depth/Breadth */}
        <Section title="Depth ↔ Breadth">
          <ReasoningNote log={log} field="depthBreadth" />
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              defaultValue={calibration?.depthBreadth ?? 0.5}
              onMouseUp={e => updateField('depthBreadth', parseFloat((e.target as HTMLInputElement).value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Breadth survey</span>
              <span>Deep on fewer concepts</span>
            </div>
          </div>
        </Section>

        {/* Tone */}
        <Section title="Tone Preferences">
          <ReasoningNote log={log} field="tonePreferences" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Formality</label>
              <select
                defaultValue={calibration?.tonePreferences?.formality ?? 'professional'}
                onChange={e => updateField('tonePreferences', { ...calibration?.tonePreferences, formality: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="academic">Academic</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Scaffolding</label>
              <select
                defaultValue={calibration?.tonePreferences?.scaffolding_level ?? 'moderate'}
                onChange={e => updateField('tonePreferences', { ...calibration?.tonePreferences, scaffolding_level: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="minimal">Minimal</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Seed questions */}
        <Section title="Seed Questions">
          <ReasoningNote log={log} field="seedQuestions" />
          {calibration?.seedQuestions.length ? (
            <ul className="space-y-2">
              {calibration.seedQuestions.map((q, i) => (
                <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
                  <span className="font-medium mr-1">[{q.type}]</span>{q.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No seed questions yet. Upload sources and the agent will propose questions when connected.</p>
          )}
        </Section>

        {/* Concept emphasis */}
        <Section title="Concept Emphasis">
          <ReasoningNote log={log} field="emphasisConcepts" />
          <p className="text-xs text-muted-foreground">
            {calibration?.emphasisConcepts.length
              ? `Emphasizing: ${calibration.emphasisConcepts.slice(0, 5).join(', ')}`
              : 'No emphasis set — all concepts weighted equally.'}
          </p>
        </Section>

        {/* Reasoning log */}
        {log.length > 0 && (
          <Section title="Agent Reasoning Log">
            <div className="space-y-2">
              {log.map((entry, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-card p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{entry.field}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.source === 'agent_inferred' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                      {entry.source === 'agent_inferred' ? 'agent' : 'instructor'}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{entry.rationale}</p>
                  <p className="text-muted-foreground/60">{new Date(entry.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

function ReasoningNote({ log, field }: { log: ReasoningLogEntry[]; field: string }) {
  const entry = [...log].reverse().find(e => e.field === field)
  if (!entry) return null
  return (
    <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-secondary/10 px-3 py-2">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
      <p className="text-xs text-muted-foreground">{entry.rationale}</p>
    </div>
  )
}
