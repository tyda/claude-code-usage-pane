import type { ClientModule } from 'claude-code'

const FRAME_MS = 150
const W = 21
// Two pixels per terminal row, drawn as half blocks: K ear tip, E eye, W eye shine, R cheek, M tongue, B tail base.
const PIXELS = [
  'K.............K......',
  'KK...........KK..YYYY',
  '.KK.........KK..YYYYY',
  '.YYY.......YYY..YYYY.',
  '..YYY.....YYY....YY..',
  '..YYYYYYYYYYY.....YYY',
  '..YYYYYYYYYYY....YYYY',
  '.YYYEEYYYEEYYY..YYY..',
  '.YYYEWYYYEWYYY..YY...',
  '.YRRYYYYYYYRRY...YY..',
  '.YRRYYEMEYYRRY...Y...',
  '..YYYYYMYYYYY...Y....',
  '...YYYYYYYYY...BY....',
  '..YYYYYYYYYYYBB......',
  '.YY.YYYYYYY.YY.......',
  '...YYYYYYYYY.........',
  '...YYYYYYYYY.........',
  '...YY.....YY.........',
]
const PALETTE: Record<string, string> = {
  K: '#3a3a3a',
  E: '#111111',
  W: '#ffffff',
  Y: '#f8d030',
  R: '#e83838',
  M: '#a02828',
  B: '#8a5a20',
  S: '#fff27a',
}
export const FULL_ROWS = PIXELS.length / 2 + 1
export const MIN_ROWS = 5
// Pixel rows dropped first as the pane gets shorter, chosen so the face stays readable.
const DROP_ORDER = [15, 13, 16, 5, 4, 12, 14, 1, 6, 3]
const EYE_TOP = 7
const EYES = [4, 5, 9, 10]
const CHEEK_ROW = 9
const SPARK_COLS = [0, 14]
const BLINK_PERIOD = 40
const BLINK_AT = 20
const BLINK_LEN = 2
const SPARK_PERIOD = 40
const SPARK_START = 18
const SPARK_LEN = 12
const SPARK_CHARS = ['*', '+', '\'', '`']
const TWITCH_PERIOD = 55
const TWITCH_AT = 8
const TWITCH_LEN = 3
const GRASS = ',.\'.,;.,\'.,.;,.\',.,;.'

type Cell = { ch: string; color?: string; bg?: string; dim?: boolean; bold?: boolean }

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

export type TreeProps = { rows: number }

function pixels(t: number): string[][] {
  const blinking = (t + BLINK_AT) % BLINK_PERIOD < BLINK_LEN
  const twitching = (t + TWITCH_AT) % TWITCH_PERIOD < TWITCH_LEN
  const sparking = t % SPARK_PERIOD >= SPARK_START && t % SPARK_PERIOD < SPARK_START + SPARK_LEN
  const px = PIXELS.map(line => [...line])

  if (blinking) {
    for (const c of EYES) {
      px[EYE_TOP][c] = 'Y'
      px[EYE_TOP + 1][c] = 'E'
    }
  }
  if (twitching) {
    for (const [r, from, to] of [[0, 14, 14], [1, 13, 14]]) {
      for (let c = from; c <= to; c++) px[r][c] = '.'
      for (let c = from; c <= to; c++) px[r][c + 1] = 'K'
    }
  }
  if (sparking) {
    for (const row of px) for (let c = 0; c < W; c++) if (row[c] === 'R') row[c] = 'S'
  }
  return px
}

function scene(t: number, height: number): Cell[][] {
  const dropped = new Set(DROP_ORDER.slice(0, Math.max(0, PIXELS.length - 2 * (height - 1))))
  const kept = pixels(t).flatMap((row, r) => (dropped.has(r) ? [] : [{ row, r }]))
  if (kept.length % 2) kept.unshift({ row: [...'.'.repeat(W)], r: -1 })

  const rows: Cell[][] = []
  for (let i = 0; i < kept.length; i += 2) {
    const top = kept[i].row
    const bottom = kept[i + 1].row
    rows.push(top.map((p, c): Cell => {
      const up = PALETTE[p]
      const down = PALETTE[bottom[c]]
      if (up && down) return { ch: '▀', color: up, bg: down }
      if (up) return { ch: '▀', color: up }
      if (down) return { ch: '▄', color: down }
      return { ch: ' ' }
    }))
  }

  const sparking = t % SPARK_PERIOD >= SPARK_START && t % SPARK_PERIOD < SPARK_START + SPARK_LEN
  const cheek = kept.findIndex(k => k.r === CHEEK_ROW) >> 1
  if (sparking && cheek >= 0) {
    for (const c of SPARK_COLS) {
      for (let dr = -1; dr <= 1; dr++) {
        const cell = rows[cheek + dr]?.[c]
        if (!cell || cell.ch !== ' ' || (dr !== 0 && hash(dr + 2, c, t) % 3 === 0)) continue
        rows[cheek + dr][c] = { ch: dr === 0 ? '*' : SPARK_CHARS[hash(dr + 2, c, t >> 1) % SPARK_CHARS.length], color: 'warning', bold: true }
      }
    }
  }

  rows.push(Array.from({ length: W }, (_, c): Cell => ({ ch: GRASS[c], dim: true })))
  return rows
}

const same = (a: Cell, b: Cell) => a.color === b.color && a.bg === b.bg && !!a.dim === !!b.dim && !!a.bold === !!b.bold

const Tree: ClientModule<TreeProps, number> = (props, s) => {
  const { Box, Text } = s.elements
  if (s.state === undefined) {
    let t = 0
    s.every(FRAME_MS, () => s.setState(++t))
  }

  return (
    <Box flexDirection="column">
      {scene(s.state ?? 0, props.rows).map((row, i) => {
        const runs: Cell[] = []
        for (const cell of row) {
          const last = runs[runs.length - 1]
          if (last && same(last, cell)) last.ch += cell.ch
          else runs.push({ ...cell })
        }
        return (
          <Text key={String(i)}>
            {runs.map((run, j) => (
              <Text key={String(j)} color={run.color} backgroundColor={run.bg} dimColor={run.dim} bold={run.bold}>
                {run.ch}
              </Text>
            ))}
          </Text>
        )
      })}
    </Box>
  )
}

export default Tree
