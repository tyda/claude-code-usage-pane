import { expect, mock, test } from 'claude-code/testing'
import { remaining, severity } from '../hooks/usage'
import { frame } from '../hooks/marquee'

const PANE = {
  plugin: 'usage-pane',
  component: 'Pane',
  requestId: 'usage-pane',
  props: {
    title: 'Usage',
    isFocused: false,
    bodyColumns: 34,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
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
    expect(await ui.find({ text: /placement/ })).toBeUndefined()
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
  expect(await ui.find({ text: 'Status Unavailable' })).toBeDefined()
  expect(await ui.find({ text: 'In/Out Unavailable' })).toBeDefined()
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
  expect(await ui.find({ text: 'In 220k · Out 6k' })).toBeDefined()
  await ui.unmount()
})

test('pikachu blinks, twitches an ear and sparks from its cheeks', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: null }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = async () => {
      const runs = await ui.findAll({ type: 'Text', in: 'tree' })
      return runs.map(r => `${r.props.color ?? ''}/${r.props.backgroundColor ?? ''}:${r.text}`).join('|')
    }
    const still = await text()
    expect(still).toContain('#ffffff')
    expect(still).toContain('▀')
    expect(still).not.toContain('*')
    let blinked = false
    let sparked = false
    for (let i = 0; i < 40; i++) {
      await ui.advance(150)
      const now = await text()
      if (!now.includes('#ffffff')) blinked = true
      if (now.includes('*')) sparked = true
    }
    expect({ blinked, sparked }).toEqual({ blinked: true, sparked: true })
    expect(await text()).toBe(still)
    await ui.unmount()
  }
})

test('a short pane shrinks the tree to fit, then drops it', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: null }))
  const rowsOf = async (bodyRows: number) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, scroll: { offset: 0, bodyRows } } })
    const tree = await ui.find({ type: 'Box', in: 'tree' }).catch(() => undefined)
    await ui.unmount()
    return tree ? tree.text.length / 21 : 0
  }
  expect(await rowsOf(40)).toBe(12)
  expect(await rowsOf(22)).toBe(8)
  expect(await rowsOf(19)).toBe(5)
  expect(await rowsOf(18)).toBe(0)
})

test('marquee scrolls the configured file joined into one line', { options: { marqueeFile: 'D:/notes/marquee.txt' } }, async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: null }))
  on('fs.read', () => ({ value: '公告一\r\n\r\nsecond line\n' }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const first = (await ui.find({ type: 'Text', in: 'marquee' }))?.text ?? ''
    expect(first.startsWith('公告一   ·   second line')).toBe(true)
    await ui.advance(200)
    expect((await ui.find({ type: 'Text', in: 'marquee' }))?.text.startsWith('告一')).toBe(true)
    await ui.unmount()
  }
})

test('no marquee without a configured file', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: null }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await expect(ui.find({ in: 'marquee' })).rejects.toThrow('no Client keyed "marquee"')
  await ui.unmount()
})

test('marquee frame fits wide characters into the width', () => {
  expect(frame('ab中', 5, 0)).toBe('ab中 ')
  expect(frame('ab中', 4, 1)).toBe('b中 ')
})
