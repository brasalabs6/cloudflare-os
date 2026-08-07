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
import { Button } from '@cloudflare/kumo'
import {
  Circle, CaretDown, CaretRight, Pause, Play, Stop, ArrowClockwise,
  WarningCircle, Warning, Lightning,
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

// ─── Error type configuration ───────────────────────────────────────────────
//
// Maps bridge error types to UI presentation: icon, color, human-readable
// description, and whether the error is recoverable (Retry) or fatal (Reset).
//
// Recoverable errors: the caller can retry after a short wait — the container
// or agent might come back on its own.
// Fatal errors: something is fundamentally wrong (bad config, validation
// failure) and the session needs to be reset.

const RECOVERABLE_ERRORS = new Set([
  'container_not_ready',
  'grok_agent_not_running',
  'rpc_timeout',
  'bridge_error',
  'computer_error',
])

interface ErrorConfig {
  icon: typeof WarningCircle
  color: string
  description: string
  recoverable: boolean
}

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
  container_not_ready: {
    icon: Lightning,
    color: 'var(--color-kumo-warning)',
    description: 'The container is still starting up. Wait a moment and retry.',
    recoverable: true,
  },
  grok_agent_not_running: {
    icon: Warning,
    color: 'var(--color-kumo-warning)',
    description: 'The grok agent is not running. Try retrying or resetting the session.',
    recoverable: true,
  },
  rpc_timeout: {
    icon: WarningCircle,
    color: 'var(--color-kumo-warning)',
    description: 'The agent took too long to respond. Try again or reset the session.',
    recoverable: true,
  },
  boot_failed: {
    icon: WarningCircle,
    color: 'var(--color-kumo-danger)',
    description: 'Boot configuration failed. Check your repos, dotfiles, and credentials, then reset.',
    recoverable: false,
  },
  validation_error: {
    icon: Warning,
    color: 'var(--color-kumo-danger)',
    description: 'The request was rejected due to invalid input. Fix the configuration and reset.',
    recoverable: false,
  },
  exec_failed: {
    icon: WarningCircle,
    color: 'var(--color-kumo-danger)',
    description: 'Command execution failed inside the container.',
    recoverable: false,
  },
  unauthorized: {
    icon: WarningCircle,
    color: 'var(--color-kumo-danger)',
    description: 'Authentication failed. Check the bridge API key configuration.',
    recoverable: false,
  },
  computer_error: {
    icon: WarningCircle,
    color: 'var(--color-kumo-danger)',
    description: 'An unexpected error occurred during the computer agent run.',
    recoverable: true,
  },
  bridge_error: {
    icon: WarningCircle,
    color: 'var(--color-kumo-danger)',
    description: 'The bridge returned an error. Try retrying or resetting the session.',
    recoverable: true,
  },
}

/**
 * Returns the error config for a given error code, falling back to a
 * generic error config for unknown codes.
 */
function getErrorConfig(code?: string): ErrorConfig | null {
  if (!code) return null
  return ERROR_CONFIGS[code] ?? {
    icon: WarningCircle,
    color: 'var(--color-kumo-danger)',
    description: 'An unknown error occurred.',
    recoverable: RECOVERABLE_ERRORS.has(code),
  }
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

// ─── Typed error banner ─────────────────────────────────────────────────────
//
// Shows a colored banner with an icon, the error message, a human-readable
// description, and action buttons (Retry for recoverable, Reset for fatal).

function TypedErrorBanner({
  error,
  code,
  onReset,
}: {
  error: string
  code?: string
  onReset: () => void
}) {
  const config = getErrorConfig(code)
  const Icon = config?.icon ?? WarningCircle
  const color = config?.color ?? 'var(--color-kumo-danger)'
  const recoverable = config?.recoverable ?? true

  return (
    <div
      className="rounded-lg p-3 mt-1"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2">
        <Icon size={16} style={{ color, flexShrink: 0, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium" style={{ color }}>
            {error}
          </div>
          {config && (
            <div className="text-[11px] text-kumo-subtle mt-0.5">
              {config.description}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            {recoverable ? (
              <Button size="sm" variant="secondary" onClick={onReset}>
                <ArrowClockwise size={12} className="mr-1" /> Retry
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={onReset}>
                <Stop size={12} className="mr-1" /> Reset Session
              </Button>
            )}
          </div>
        </div>
      </div>
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

          {/* Typed error banner with retry/reset actions */}
          {runStatus.error && (
            <TypedErrorBanner
              error={runStatus.error}
              code={runStatus.code}
              onReset={onReset}
            />
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
