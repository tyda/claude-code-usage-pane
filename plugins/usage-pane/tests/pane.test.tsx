import { expect, mock, test } from 'claude-code/testing'
import { remaining, severity } from '../hooks/usage'

const PANE = {
  plugin: 'usage-pane',
  component: 'Pane',
  requestId: 'usage-pane',
  props: {
    title: 'Usage',
    isFocused: false,
    bodyColumns: 34,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const NOW = Date.parse('2026-10-07T10:00:00Z')

test('shows model, context and both limits with countdowns', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: {
    startedAt: NOW,
    context: { tokens: 90_000, window: 200_000, percent: 45 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-07T12:14:00Z' },
      { kind: 'seven_day', percentUsed: 71, resetsAt: '2026-10-10T10:00:00Z' },
    ],
  } }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: 'claude-opus-5-5' })).toBeDefined()
    expect(await ui.find({ text: /45%/ })).toBeDefined()
    expect(await ui.find({ text: '90k / 200k' })).toBeDefined()
    expect(await ui.find({ text: 'Used 23.5% | Left 76.5%' })).toBeDefined()
    expect(await ui.find({ text: /Reset 2h14m/ })).toBeDefined()
    expect(await ui.find({ text: 'Used 71% | Left 29%' })).toBeDefined()
    expect(await ui.find({ text: /Reset 3d0h/ })).toBeDefined()
    expect(await ui.find({ text: 'NORMAL' })).toBeDefined()
    expect(await ui.find({ text: 'Tokens 90k' })).toBeDefined()
    expect(await ui.find({ text: 'placement: dock (right)' })).toBeDefined()
    await ui.unmount()
  }
})

test('shows Unavailable when no usage is reported', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [] } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: 'Unavailable' })).toBeDefined()
  expect(await ui.find({ text: '5-hour' })).toBeDefined()
  expect(await ui.find({ text: /%/ })).toBeUndefined()
  expect(await ui.find({ text: 'window 200k' })).toBeDefined()
  expect(await ui.find({ text: 'Status: Unavailable' })).toBeDefined()
  expect(await ui.find({ text: 'Tokens Unavailable' })).toBeDefined()
  expect(await ui.find({ text: 'Input Unavailable' })).toBeDefined()
  expect(await ui.find({ text: 'Output Unavailable' })).toBeDefined()
  await ui.unmount()
  const inline = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, placement: 'inline' } })
  expect(await inline.find({ text: 'placement: inline (needs fullscreen)' })).toBeDefined()
  await inline.unmount()
})

test('remaining percentage', () => {
  expect(remaining(48)).toBe(52)
  expect(remaining(23.5)).toBe(76.5)
  expect(remaining(0)).toBe(100)
  expect(remaining(104)).toBe(0)
})

test('context severity thresholds', () => {
  expect(severity(69.9)).toBe('NORMAL')
  expect(severity(70)).toBe('WARNING')
  expect(severity(89)).toBe('WARNING')
  expect(severity(90)).toBe('CRITICAL')
  expect(severity(100)).toBe('CRITICAL')
})

const usageAt = (percent: number) => ({ value: {
  startedAt: NOW,
  context: { tokens: percent * 10_000, window: 1_000_000, percent },
  rateLimits: [],
} })

test('70% context shows WARNING', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => usageAt(72))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: 'Context 72%' })).toBeDefined()
  expect(await ui.find({ text: 'WARNING' })).toBeDefined()
  await ui.unmount()
})

test('90% context shows CRITICAL', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => usageAt(92))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: 'Context 92%' })).toBeDefined()
  expect(await ui.find({ text: 'CRITICAL' })).toBeDefined()
  await ui.unmount()
})

test('sums input and output from completed main-loop turns only', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => usageAt(16))
  const usage = { input_tokens: 2_000, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 8_000, output_tokens: 3_000, model: 'claude-opus-5-5' }
  on('turn.complete', () => ({ text: '' }))
  const turn = { answer: '', durationMs: 1, isAborted: false, reason: 'answer', usage } as const
  await $.turn.complete({ ...turn, turnId: 't1' })
  await $.turn.complete({ ...turn, turnId: 't2' })
  await $.turn.complete({ ...turn, turnId: 't3', agentId: 'sub' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: 'Input 220k' })).toBeDefined()
  expect(await ui.find({ text: 'Output 6k' })).toBeDefined()
  await ui.unmount()
})
