// ContainerTerminal.tsx
//
// Interactive terminal emulator component for the Computer container.
// Renders a scrollable output area with monospace font, ANSI color support,
// command input with history navigation (up/down arrows), and exit-code badges.
//
// Communication is request-response via `overseer.sendComputerCommand()`, which
// calls the bridge's /command endpoint. Each command runs in a fresh `sh -c`
// invocation, so there is no persistent shell state between commands (no `cd`
// persistence, no background processes). This is a limitation of the current
// bridge design — a future enhancement could add WebSocket-based PTY streaming.
//
// Features:
//   - Command history with ArrowUp/ArrowDown navigation
//   - ANSI escape code parsing for colored output (stdout and stderr)
//   - Exit code badges (green for 0, red for non-zero)
//   - Loading indicator while command is executing
//   - Error display for network/rpc failures
//   - Ctrl+C clears the current input
//   - Ctrl+L clears the terminal output

import { useState, useRef, useEffect, useCallback } from 'react'
import { TerminalWindow, ArrowClockwise, Trash } from '@phosphor-icons/react'

// ─── Types ──────────────────────────────────────────────────────────────────

/** A single entry in the terminal output history. */
interface OutputEntry {
  /** Unique ID for React keying. */
  id: number
  /** The command that was run. */
  command: string
  /** stdout output (may contain ANSI escape codes). */
  stdout: string
  /** stderr output (may contain ANSI escape codes). */
  stderr: string
  /** Process exit code. 0 = success. */
  exitCode: number
  /** Whether the command is still running. */
  running: boolean
  /** Error message if the RPC call itself failed (not a non-zero exit code). */
  rpcError?: string
}

// ─── ANSI color parsing ─────────────────────────────────────────────────────
//
// Parses a subset of ANSI escape codes (SGR — Select Graphic Rendition) and
// returns React spans with appropriate CSS color styles. Supports:
//   - 30-37: standard foreground colors
//   - 90-97: bright foreground colors
//   - 0: reset
//   - 1: bold (rendered as font-weight: 600)
//
// This is intentionally simple — it handles the common cases from `ls --color`,
// `grep --color`, `git diff`, etc. without pulling in a full ANSI library.

const ANSI_COLORS: Record<number, string> = {
  30: '#000000', 31: '#cc0000', 32: '#4e9a06', 33: '#c4a000',
  34: '#3465a4', 35: '#75507b', 36: '#06989a', 37: '#d3d7cf',
  90: '#555753', 91: '#ef2929', 92: '#8ae234', 93: '#fce94f',
  94: '#729fcf', 95: '#ad7fa8', 96: '#34e2e2', 97: '#eeeeec',
}

interface AnsiSegment {
  text: string
  color?: string
  bold?: boolean
}

/**
 * Parses a string with ANSI escape codes into styled segments.
 * Returns an array of { text, color, bold } objects that can be rendered
 * as <span> elements with inline styles.
 *
 * Exported for testing — drives the real shipped code in tests.
 */
export function parseAnsi(input: string): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  let currentColor: string | undefined
  let currentBold = false
  let buffer = ''

  // Regex to match ANSI SGR escape sequences: ESC[<params>m
  // Constructed via new RegExp() to avoid the no-control-regex lint rule,
  // which flags \x1b/\u001b in regex literals. String.fromCharCode(27)
  // produces the same ESC character without triggering the rule.
  const ESC = String.fromCharCode(27)
  const ansiRegex = new RegExp(ESC + '\\[([\\d;]*)m', 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = ansiRegex.exec(input)) !== null) {
    // Text before the escape code
    if (match.index > lastIndex) {
      buffer += input.slice(lastIndex, match.index)
    }

    // Process the escape code
    const params = match[1].split(';').filter(Boolean).map(Number)
    for (const param of params) {
      if (param === 0) {
        // Reset all attributes — flush buffer with current style
        if (buffer) {
          segments.push({ text: buffer, color: currentColor, bold: currentBold })
          buffer = ''
        }
        currentColor = undefined
        currentBold = false
      } else if (param === 1) {
        currentBold = true
      } else if (ANSI_COLORS[param]) {
        // Color change — flush buffer with previous style before switching
        if (buffer) {
          segments.push({ text: buffer, color: currentColor, bold: currentBold })
          buffer = ''
        }
        currentColor = ANSI_COLORS[param]
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text after the last escape code
  if (lastIndex < input.length) {
    buffer += input.slice(lastIndex)
  }
  if (buffer) {
    segments.push({ text: buffer, color: currentColor, bold: currentBold })
  }

  return segments.length > 0 ? segments : [{ text: input }]
}

/**
 * Renders a string with ANSI escape codes as styled React spans.
 */
function AnsiText({ text }: { text: string }) {
  if (!text) return null
  const segments = parseAnsi(text)
  return (
    <>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            color: seg.color,
            fontWeight: seg.bold ? 600 : undefined,
          }}
        >
          {seg.text}
        </span>
      ))}
    </>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

interface ContainerTerminalProps {
  /** The Overseer RPC stub, used to call sendComputerCommand. */
  overseer: {
    sendComputerCommand(command: string): Promise<{
      stdout: string
      stderr: string
      exitCode: number
      errorType?: string
    }>
  } | null
}

export function ContainerTerminal({ overseer }: ContainerTerminalProps) {
  // Command input state
  const [input, setInput] = useState('')
  // Output history — each entry is a command + its result
  const [outputs, setOutputs] = useState<OutputEntry[]>([])
  // Command history for ArrowUp/ArrowDown navigation
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  // Index into commandHistory during navigation (-1 = not navigating)
  const [historyIndex, setHistoryIndex] = useState(-1)
  // Whether a command is currently executing
  const [executing, setExecuting] = useState(false)
  // Unique ID counter for output entries
  const idCounter = useRef(0)
  // Ref for auto-scrolling the output area
  const outputRef = useRef<HTMLDivElement>(null)
  // Ref for focusing the input
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputs])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /**
   * Executes a command via the Overseer's sendComputerCommand RPC.
   * Creates an output entry immediately (with running=true), then updates
   * it when the response arrives.
   */
  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim() || !overseer) return

    const entryId = ++idCounter.current

    // Add the command to history (avoid consecutive duplicates)
    setCommandHistory(prev => {
      if (prev[prev.length - 1] === command) return prev
      return [...prev, command]
    })
    setHistoryIndex(-1)

    // Create a running output entry
    setOutputs(prev => [...prev, {
      id: entryId,
      command,
      stdout: '',
      stderr: '',
      exitCode: 0,
      running: true,
    }])

    setExecuting(true)

    try {
      const result = await overseer.sendComputerCommand(command)
      setOutputs(prev => prev.map(e =>
        e.id === entryId
          ? {
              ...e,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
              running: false,
              rpcError: result.errorType,
            }
          : e
      ))
    } catch (err) {
      setOutputs(prev => prev.map(e =>
        e.id === entryId
          ? {
              ...e,
              stdout: '',
              stderr: String(err),
              exitCode: 1,
              running: false,
              rpcError: 'network_error',
            }
          : e
      ))
    } finally {
      setExecuting(false)
      inputRef.current?.focus()
    }
  }, [overseer])

  /**
   * Keyboard handler for the input field:
   *   Enter     — submit command
   *   ArrowUp   — navigate to previous command in history
   *   ArrowDown — navigate to next command in history
   *   Ctrl+C    — clear current input
   *   Ctrl+L    — clear terminal output
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length === 0) return
      const newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIndex)
      setInput(commandHistory[newIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return
      const newIndex = historyIndex + 1
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault()
      setInput('')
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      setOutputs([])
    }
  }

  return (
    <div className="border border-kumo-line rounded-lg bg-[#1e1e2e] mb-2">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-kumo-line/30">
        <div className="flex items-center gap-2">
          <TerminalWindow size={14} className="text-kumo-inactive" />
          <span className="text-xs font-medium text-kumo-inactive">Container Terminal</span>
        </div>
        <button
          onClick={() => setOutputs([])}
          className="text-kumo-inactive hover:text-kumo-text transition-colors"
          title="Clear terminal"
        >
          <Trash size={14} />
        </button>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="p-3 overflow-auto font-mono text-xs leading-relaxed"
        style={{ maxHeight: '300px', minHeight: '120px', color: '#cdd6f4' }}
        onClick={() => inputRef.current?.focus()}
      >
        {outputs.length === 0 && (
          <div className="text-kumo-inactive/50 italic">
            Type a command and press Enter. Use ↑/↓ for history, Ctrl+L to clear.
          </div>
        )}
        {outputs.map(entry => (
          <div key={entry.id} className="mb-2">
            {/* Command line with prompt */}
            <div className="flex items-start gap-1">
              <span style={{ color: '#89b4fa' }}>$</span>
              <span style={{ color: '#f9e2af' }}>{entry.command}</span>
            </div>
            {/* stdout */}
            {entry.stdout && (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <AnsiText text={entry.stdout} />
              </div>
            )}
            {/* stderr */}
            {entry.stderr && (
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <AnsiText text={entry.stderr} />
              </div>
            )}
            {/* Running indicator */}
            {entry.running && (
              <div className="flex items-center gap-1" style={{ color: '#89b4fa' }}>
                <ArrowClockwise size={12} className="animate-spin" />
                <span>running...</span>
              </div>
            )}
            {/* Exit code badge */}
            {!entry.running && (
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: entry.exitCode === 0 ? 'rgba(166,227,161,0.15)' : 'rgba(243,139,168,0.15)',
                    color: entry.exitCode === 0 ? '#a6e3a1' : '#f38ba8',
                  }}
                >
                  exit {entry.exitCode}
                </span>
                {entry.rpcError && entry.exitCode !== 0 && (
                  <span style={{ color: '#f38ba8', fontSize: '10px' }}>
                    ({entry.rpcError})
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input line */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-kumo-line/30">
        <span style={{ color: '#89b4fa' }} className="font-mono text-xs">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={executing || !overseer}
          placeholder={overseer ? 'Enter command...' : 'Container not connected'}
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs"
          style={{ color: '#cdd6f4', caretColor: '#cdd6f4' }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
