'use client'

import type { CalibrationVersion, RubricVersion } from '@/lib/db'

type Props = {
  calibrationVersions: CalibrationVersion[]
  rubricVersions: RubricVersion[]
}

export function VersionHistory({ calibrationVersions, rubricVersions }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calibration Versions</p>
        <div className="space-y-1.5">
          {calibrationVersions.map(cv => (
            <div key={cv.id} className={`rounded-lg border p-3 ${cv.isActive ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">…{cv.id.slice(-8)}</span>
                {cv.isActive && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">Active</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(cv.createdAt * 1000).toLocaleDateString()} by {cv.createdBy}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Depth/breadth: {cv.depthBreadth.toFixed(2)} · {cv.seedQuestions.length} seed Qs · {cv.reasoningLog.length} log entries
              </p>
            </div>
          ))}
          {calibrationVersions.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubric Versions</p>
        <div className="space-y-1.5">
          {rubricVersions.map(rv => (
            <div key={rv.id} className={`rounded-lg border p-3 ${rv.isActive ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">…{rv.id.slice(-8)}</span>
                {rv.isActive && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">Active</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(rv.createdAt * 1000).toLocaleDateString()} · {rv.source}
                {rv.templateId ? ` (${rv.templateId})` : ''}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rv.dimensions.length} dimensions · {rv.dimensions.filter(d => d.active).length} active
              </p>
            </div>
          ))}
          {rubricVersions.length === 0 && <p className="text-xs text-muted-foreground">No rubric versions yet.</p>}
        </div>
      </div>
    </div>
  )
}
