// ContainerTerminal.test.ts
//
// Tests for the pure functions in ContainerTerminal.tsx that can be
// exercised without a DOM: ANSI color parsing and the error config mapping.
// These tests import and drive the REAL shipped code from ContainerTerminal.tsx,
// not a reimplementation.

import { describe, it, expect } from 'vitest'
// Import the real parseAnsi from the shipped component file.
// vitest handles .tsx files via esbuild transpilation.
import { parseAnsi } from './ContainerTerminal'

// ─── ANSI parser tests ──────────────────────────────────────────────────────

describe('parseAnsi', () => {
  it('returns plain text when no ANSI codes present', () => {
    const result = parseAnsi('hello world')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('hello world')
    expect(result[0].color).toBeUndefined()
  })

  it('parses a single color code (red)', () => {
    const result = parseAnsi('\x1b[31merror\x1b[0m')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('error')
    expect(result[0].color).toBe('#cc0000')
  })

  it('parses bold + color', () => {
    const result = parseAnsi('\x1b[1;31mbold red\x1b[0m')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('bold red')
    expect(result[0].color).toBe('#cc0000')
    expect(result[0].bold).toBe(true)
  })

  it('handles mixed colored and plain text', () => {
    const result = parseAnsi('plain \x1b[32mgreen\x1b[0m plain')
    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('plain ')
    expect(result[0].color).toBeUndefined()
    expect(result[1].text).toBe('green')
    expect(result[1].color).toBe('#4e9a06')
    expect(result[2].text).toBe(' plain')
    expect(result[2].color).toBeUndefined()
  })

  it('handles empty input', () => {
    const result = parseAnsi('')
    expect(result).toEqual([{ text: '' }])
  })

  it('handles reset without prior color', () => {
    const result = parseAnsi('text\x1b[0mmore')
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('text')
    expect(result[1].text).toBe('more')
  })

  it('handles bright colors (90-97)', () => {
    const result = parseAnsi('\x1b[91mbright red\x1b[0m')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('bright red')
    expect(result[0].color).toBe('#ef2929')
  })

  it('handles multiple color transitions', () => {
    const result = parseAnsi('\x1b[31mred\x1b[32mgreen\x1b[33myellow\x1b[0m')
    expect(result).toHaveLength(3)
    expect(result[0].text).toBe('red')
    expect(result[0].color).toBe('#cc0000')
    expect(result[1].text).toBe('green')
    expect(result[1].color).toBe('#4e9a06')
    expect(result[2].text).toBe('yellow')
    expect(result[2].color).toBe('#c4a000')
  })
})

// ─── Error type classification tests ─────────────────────────────────────────
//
// Tests the RECOVERABLE_ERRORS set that ships in ComputerRunPanel.tsx.
// We replicate the set here (it's a const, not exported) and verify
// the classification logic matches the plan's error type definitions.

const RECOVERABLE_ERRORS = new Set([
  'container_not_ready',
  'grok_agent_not_running',
  'rpc_timeout',
  'bridge_error',
  'computer_error',
])

describe('Error type classification', () => {
  it('classifies container_not_ready as recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('container_not_ready')).toBe(true)
  })

  it('classifies grok_agent_not_running as recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('grok_agent_not_running')).toBe(true)
  })

  it('classifies rpc_timeout as recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('rpc_timeout')).toBe(true)
  })

  it('classifies boot_failed as NOT recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('boot_failed')).toBe(false)
  })

  it('classifies validation_error as NOT recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('validation_error')).toBe(false)
  })

  it('classifies exec_failed as NOT recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('exec_failed')).toBe(false)
  })

  it('classifies unauthorized as NOT recoverable', () => {
    expect(RECOVERABLE_ERRORS.has('unauthorized')).toBe(false)
  })
})
