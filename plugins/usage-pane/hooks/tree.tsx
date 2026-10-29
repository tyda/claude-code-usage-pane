import type { ClientModule } from 'claude-code'

const FRAME_MS = 150
const W = 21
// Two pixels per terminal row, drawn as half blocks: O skin, C belly, E/T/W eye, M/P mouth, L claw, F/Y flame.
const PIXELS = [
  '.....................',
  '....OOOOO............',
  '..OOOOOOOOO.......F..',
  '.OOOOOOOOOOO.....FF..',
  '.OOEWOOOOEWOO...FFYF.',
  '.OOETOOOOETOO...FYYF.',
  'OOOEEOOOOEEOOO..FYYF.',
  'OOOMMMMMMMOOOO...FY..',
  '.OOOMPPPMOOOO.....O..',
  'OOOOOOOOOOOOOO....O..',
  'L..OCCCCCCO..L...OO..',
  '...OCCCCCCOO....OO...',
  '...OCCCCCCOOO.OOO....',
  '...OOCCCCOOOOOO......',
  '...OOOOOOOOO.........',
  '..OOO....OOO.........',
  '..OOO....OOO.........',
  '.LLOO....OOLL........',
]
const PALETTE: Record<string, string> = {
  O: '#f08030',
  C: '#f8e0a0',
  E: '#102030',
  T: '#20a0a8',
  W: '#ffffff',
  M: '#801818',
  P: '#f07890',
  L: '#f0f0f0',
  F: '#e83020',
  Y: '#f8d030',
}
export const FULL_ROWS = PIXELS.length / 2 + 1
export const MIN_ROWS = 5
// Pixel rows dropped first as the pane gets shorter, chosen so the face stays readable.
const DROP_ORDER = [0, 15, 11, 12, 14, 1, 16, 10, 13, 2]
const EYE_TOP = 4
const EYES = [3, 4, 9, 10]
// Flame tip rows that change between flicker frames; the rows between them stay put.
const FLAME_COL = 16
const FLAMES = [
  { 2: '..F.', 3: '.FF.', 7: '.FY.' },
  { 2: '.F..', 3: '.FF.', 7: '.YF.' },
  { 2: '..F.', 3: '.FF.', 7: '.FY.' },
  { 2: '...F', 3: '..FF', 7: '.FY.' },
]
const FLICKER_FRAMES = 2
const EMBER_COLS = [17, 18, 19]
const BLINK_PERIOD = 40
const BLINK_AT = 20
const BLINK_LEN = 2
const EMBER_PERIOD = 40
const EMBER_START = 18
const EMBER_LEN = 12
const EMBER_CHARS = ['*', '+', '\'', '`']
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
  const px = PIXELS.map(line => [...line])

  if (blinking) {
    for (const c of EYES) {
      px[EYE_TOP][c] = 'O'
      px[EYE_TOP + 1][c] = 'O'
      px[EYE_TOP + 2][c] = 'E'
    }
  }
  const flame = FLAMES[Math.floor(t / FLICKER_FRAMES) % FLAMES.length]
  for (const [r, line] of Object.entries(flame)) {
    for (let i = 0; i < line.length; i++) px[Number(r)][FLAME_COL + i] = line[i]
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

  const embering = t % EMBER_PERIOD >= EMBER_START && t % EMBER_PERIOD < EMBER_START + EMBER_LEN
  if (embering) {
    EMBER_COLS.forEach((c, i) => {
      if (rows[0][c].ch !== ' ' || (i !== 1 && hash(c, t >> 1) % 3 === 0)) return
      rows[0][c] = { ch: i === 1 ? '*' : EMBER_CHARS[hash(c, t >> 1, 1) % EMBER_CHARS.length], color: 'warning', bold: true }
    })
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
