import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'
import type { SessionTotals } from '../types'
import { remaining, severity, tone } from './usage'

const PANE = 'usage-pane'
const TICK_MS = 30_000
const BAR = 10
const tick = atom({ plugin: 'usage-pane', key: 'tick' } as const, 0)
const totals = atom({ plugin: 'usage-pane', key: 'totals' } as const, null as SessionTotals | null)

// Bumping the tick redraws the pane, which reads model and usage afresh.
const bump = async ($: EngineInterface) => {
  const now = await $.clock.now()
  await update($, tick, () => now)
}

const pad = (n: number) => String(n).padStart(2, '0')

function countdown(resetsAt: string | undefined, now: number) {
  const at = resetsAt ? Date.parse(resetsAt) : NaN
  if (Number.isNaN(at)) return null
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const left = d > 0 ? `${d}d${h}h` : h > 0 ? `${h}h${pad(m)}m` : `${m}m`
  const date = new Date(at)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const when = d > 0 ? `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${clock}` : clock
  return { left, when }
}

const bar = (pct: number) => {
  const filled = Math.max(0, Math.min(BAR, Math.round((pct / 100) * BAR)))
  return '█'.repeat(filled) + '░'.repeat(BAR - filled)
}

const kTokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-pane',
      description: 'Open the usage pane (model, context, 5-hour and 7-day usage)',
    })
    $.clock.every(TICK_MS, () => void bump($))
    void $.ui.open({ id: PANE, title: 'Usage', columns: 34 })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await bump($)

    return next(e)
  })

  // Input/output counts exist only per turn, so the session's are summed here; /clear restarts them.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && e.usage) {
      const u = e.usage
      const { startedAt } = await $.session.usage()
      const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      await update($, totals, t =>
        t && t.startedAt === startedAt
          ? { ...t, input: t.input + input, output: t.output + u.output_tokens, turns: t.turns + 1 }
          : { startedAt, input, output: u.output_tokens, turns: 1 },
      )
    }
    await bump($)

    return result
  })

  on('command.run', { command: 'usage-pane' }, async ($, e) => {
    const opened = await $.ui.open({ id: PANE, title: 'Usage', columns: 34 })
    const { isFullscreen, columns } = e.presentation
    const layout = isFullscreen ? 'fullscreen' : 'main screen'
    const hint = isFullscreen
      ? columns < 110
        ? ' Docking needs at least 110 columns.'
        : ''
      : ' The pane docks only in the fullscreen layout: set "tui": "fullscreen" (or /config) and restart.'

    return {
      text: `Usage pane ${opened.isPlaced ? 'opened' : 'waiting'}; layout ${layout}, ${columns} columns; the pane's footer shows its placement.${hint}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Client } = $.ui.resolve(e)
    await read($, tick)
    const [model, usage, now, sums] = await Promise.all([
      $.session.model().catch(() => null),
      $.session.usage().catch(() => null),
      $.clock.now(),
      read($, totals),
    ])

    const limit = (kind: string, label: string) => {
      const l: SessionRateLimit | undefined = usage?.rateLimits.find(x => x.kind === kind)
      if (!l) {
        return (
          <Box flexDirection="column">
            <Text bold>{label}</Text>
            <Text dimColor>Unavailable</Text>
          </Box>
        )
      }
      const reset = countdown(l.resetsAt, now)

      return (
        <Box flexDirection="column">
          <Text>
            <Text bold>{label}</Text> <Text color={tone(l.percentUsed)}>{bar(l.percentUsed)}</Text>
          </Text>
          <Text>{`Used ${l.percentUsed}% | Left ${remaining(l.percentUsed)}%`}</Text>
          <Text dimColor>{reset ? `Reset ${reset.left} (${reset.when})` : 'Reset Unavailable'}</Text>
        </Box>
      )
    }

    const ctx = usage?.context
    const pct = ctx?.percent
    const sumsLive = sums && usage && sums.startedAt === usage.startedAt ? sums : null

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Model</Text>
          <Text wrap="truncate-end">{model || 'Unavailable'}</Text>
        </Box>
        <Box flexDirection="column">
          <Text>
            <Text bold>{pct === undefined ? 'Context' : `Context ${pct}%`}</Text>{' '}
            {pct === undefined ? <Text dimColor>Unavailable</Text> : <Text color={tone(pct)}>{bar(pct)}</Text>}
          </Text>
          <Text dimColor>
            {ctx?.tokens !== undefined && ctx.window
              ? `${kTokens(ctx.tokens)} / ${kTokens(ctx.window)}`
              : ctx?.window
                ? `window ${kTokens(ctx.window)}`
                : 'window Unavailable'}
          </Text>
          {pct === undefined ? (
            <Text dimColor>Status: Unavailable</Text>
          ) : (
            <Text>
              Status: <Text bold color={tone(pct)}>{severity(pct)}</Text>
            </Text>
          )}
        </Box>
        {limit('five_hour', '5-hour')}
        <Box flexDirection="column">
          <Text bold>Session</Text>
          <Text>{`Tokens ${ctx?.tokens !== undefined ? kTokens(ctx.tokens) : 'Unavailable'}`}</Text>
          <Text>{`Input ${sumsLive ? kTokens(sumsLive.input) : 'Unavailable'}`}</Text>
          <Text>{`Output ${sumsLive ? kTokens(sumsLive.output) : 'Unavailable'}`}</Text>
          <Text dimColor>{e.props.placement === 'dock' ? 'placement: dock (right)' : 'placement: inline (needs fullscreen)'}</Text>
        </Box>
        {limit('seven_day', '7-day')}
        {e.surface === 'terminal' || e.surface === 'desktop' ? <Client key="tree" module="./tree.tsx" /> : null}
      </Box>
    )
  })
}
