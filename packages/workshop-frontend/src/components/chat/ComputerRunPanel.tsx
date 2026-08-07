// ComputerRunPanel.tsx
//
// Collapsible panel displayed in the chat interface when a "grok-computer" model is
// active. Shows real-time status of the Computer agent run, including:
//   - Current status (booting, running, paused, completed, error, timeout)
//   - Live duration timer
//   - Loop iteration count
//   - Last output preview (truncated)
//   - Error messages
//   - Controls: pause, resume, stop, reset
//
// The panel polls Overseer.getComputerRunStatus() every 5 seconds while the run
// is active, and updates from AiChatStreamEvent "computerStatus" events in real time.

import { useState, useEffect } from 'react'
import { Button, Banner } from '@cloudflare/kumo'
import {
  Circle, CaretDown, CaretRight, Pause, Play, Stop, ArrowClockwise,
} from '@phosphor-icons/react'
import type { ComputerRunStatus } from '@gadgets/workshop-shared/api'

// ─── Status color mapping ───────────────────────────────────────────────────

const STATUS_COLORS: Record<ComputerRunStatus['status'], string> = {
  running: 'var(--color-kumo-success)',
  paused: 'var(--color-kumo-warning)',
  error: 'var(--color-kumo-danger)',
  completed: 'var(--color-kumo-info)',
  timeout: 'var(--color-kumo-warning)',
  booting: 'var(--color-kumo-info)',
  idle: 'var(--color-kumo-tint)',
}

// ─── Duration formatter ─────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

// ─── Timestamp formatter ────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ─── Row component ──────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-kumo-subtle">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ComputerRunPanel({
  runStatus,
  onPause,
  onResume,
  onStop,
  onReset,
}: {
  runStatus: ComputerRunStatus | null
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onReset: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  // Live duration timer — updates every second while the run is active.
  const [liveDuration, setLiveDuration] = useState(0)
  useEffect(() => {
    if (!runStatus || (runStatus.status !== 'running' && runStatus.status !== 'booting')) {
      return
    }
    const interval = setInterval(() => {
      setLiveDuration(Date.now() - new Date(runStatus.startedAt).getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [runStatus])

  if (!runStatus) return null

  const status = runStatus.status
  const isActive = status === 'running' || status === 'booting'

  return (
    <div className="border border-kumo-line rounded-lg p-3 mb-2 bg-kumo-surface">
      {/* Header — click to expand/collapse */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer flex items-center gap-2 select-none"
      >
        {expanded
          ? <CaretDown size={16} className="text-kumo-subtle" />
          : <CaretRight size={16} className="text-kumo-subtle" />}
        <Circle
          size={8}
          fill={STATUS_COLORS[status]}
          color={STATUS_COLORS[status]}
        />
        <span className="text-sm font-medium">Computer Run</span>
        <span className="text-xs text-kumo-subtle">{status}</span>
        {isActive && (
          <span className="text-xs text-kumo-subtle">
            {formatDuration(liveDuration || runStatus.durationMs)}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-2">
          <Row label="Run ID" value={runStatus.runId.slice(0, 8)} />
          <Row label="Loops" value={String(runStatus.loopCount)} />
          <Row label="Started" value={formatTimestamp(new Date(runStatus.startedAt))} />
          <Row label="Last Active" value={formatTimestamp(new Date(runStatus.lastActiveAt))} />
          {runStatus.grokSessionId && (
            <Row label="Grok Session" value={runStatus.grokSessionId.slice(0, 12)} />
          )}
          <Row label="Container" value={runStatus.containerAlive ? 'Alive' : 'Stopped'} />

          {/* Last output preview */}
          {runStatus.lastOutputPreview && (
            <div>
              <span className="text-xs text-kumo-subtle">Last Output</span>
              <div className="bg-kumo-tint p-2 rounded text-xs font-mono max-h-24 overflow-auto mt-1">
                {runStatus.lastOutputPreview}
              </div>
            </div>
          )}

          {/* Error message */}
          {runStatus.error && (
            <Banner variant="error" title={runStatus.error} />
          )}

          {/* Control buttons */}
          <div className="flex gap-2 mt-1">
            {status === 'running' && (
              <Button size="sm" variant="secondary" onClick={onPause}>
                <Pause size={14} className="mr-1" /> Pause
              </Button>
            )}
            {status === 'paused' && (
              <Button size="sm" variant="secondary" onClick={onResume}>
                <Play size={14} className="mr-1" /> Resume
              </Button>
            )}
            {(status === 'running' || status === 'paused') && (
              <Button size="sm" variant="destructive" onClick={onStop}>
                <Stop size={14} className="mr-1" /> Stop
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onReset}>
              <ArrowClockwise size={14} className="mr-1" /> Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
