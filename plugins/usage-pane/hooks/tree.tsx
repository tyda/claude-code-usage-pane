import type { ClientModule } from 'claude-code'

const FRAME_MS = 150
const W = 21
const ART = [
  '  /\\         /\\',
  '  \\ \\_______/ /',
  '   |         |',
  '   | o     o |',
  '  (@)  \\_/  (@)',
  '   \\         /',
  "   /`-.___.-'\\",
  '  ( |       | )',
  '   \\|_______|/',
]
const TAIL: [number, number, string][] = [
  [1, 19, '/|'],
  [2, 18, '/ |'],
  [3, 17, '/_ |'],
  [4, 19, '/'],
  [5, 18, '/'],
  [6, 17, '/'],
  [7, 15, '_/'],
]
export const FULL_ROWS = ART.length + 1
export const MIN_ROWS = 5
// Rows dropped first as the pane gets shorter, chosen so the face stays readable.
const DROP_ORDER = [2, 5, 7, 1, 6]
const EYE_ROW = 3
const EYES = [5, 11]
const CHEEK_ROW = 4
const CHEEKS = [3, 13]
const BLINK_PERIOD = 40
const BLINK_AT = 20
const BLINK_LEN = 2
const SPARK_PERIOD = 40
const SPARK_START = 18
const SPARK_LEN = 12
const SPARKS = [[0, 2], [-1, 1], [1, 1]]
const SPARK_CHARS = ['*', '+', '\'', '`']
const TWITCH_PERIOD = 55
const TWITCH_AT = 8
const TWITCH_LEN = 3
const FEET = [4, 10]
const GRASS = ',.\'.,;.,\'.,.;,.\',.,;.'

type Cell = { ch: string; color?: string; dim?: boolean; bold?: boolean }

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

const blank = (): Cell[] => Array.from({ length: W }, () => ({ ch: ' ' }))

export type TreeProps = { rows: number }

function scene(t: number, height: number): Cell[][] {
  const full = height >= FULL_ROWS
  const sparking = t % SPARK_PERIOD >= SPARK_START && t % SPARK_PERIOD < SPARK_START + SPARK_LEN
  const blinking = (t + BLINK_AT) % BLINK_PERIOD < BLINK_LEN
  const twitching = (t + TWITCH_AT) % TWITCH_PERIOD < TWITCH_LEN

  const art: Cell[][] = ART.map(line => {
    const row = blank()
    for (let c = 0; c < line.length; c++) {
      if (line[c] !== ' ') row[c] = { ch: line[c], color: 'warning' }
    }
    return row
  })

  const ear = twitching ? 14 : 13
  art[0][13] = { ch: ' ' }
  for (const c of [2, ear]) {
    art[0][c] = { ch: '/', bold: true }
    art[0][c + 1] = { ch: '\\', bold: true }
  }

  for (const c of EYES) art[EYE_ROW][c] = { ch: blinking ? '-' : 'o', bold: true }
  for (const c of [7, 8, 9]) art[CHEEK_ROW][c] = { ch: ART[CHEEK_ROW][c], color: 'error' }
  for (const c of CHEEKS) {
    art[CHEEK_ROW][c] = { ch: '@', color: sparking ? 'warning' : 'error', bold: true }
    if (!sparking) continue
    SPARKS.forEach(([dr, dc], i) => {
      if (i > 0 && hash(i, c, t) % 3 === 0) return
      art[CHEEK_ROW + dr][c < 8 ? c - dc : c + dc] ={ ch: i === 0 ? '*' : SPARK_CHARS[hash(i, c, t >> 1) % SPARK_CHARS.length], color: 'warning', bold: true }
    })
  }

  if (full) {
    for (const [r, c, s] of TAIL) {
      for (let i = 0; i < s.length; i++) if (s[i] !== ' ') art[r][c + i] = { ch: s[i], color: 'warning', bold: true }
    }
  }

  const dropped = new Set(DROP_ORDER.slice(0, Math.max(0, FULL_ROWS - height)))
  const rows = art.filter((_, r) => !dropped.has(r))

  const ground = Array.from({ length: W }, (_, c): Cell => ({ ch: GRASS[c], dim: true }))
  for (const c of FEET) {
    ground[c] = { ch: '(', color: 'warning' }
    ground[c + 1] = { ch: '_', color: 'warning' }
    ground[c + 2] = { ch: ')', color: 'warning' }
  }
  rows.push(ground)

  return rows
}

const same = (a: Cell, b: Cell) => a.color === b.color && !!a.dim === !!b.dim && !!a.bold === !!b.bold

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
              <Text key={String(j)} color={run.color} dimColor={run.dim} bold={run.bold}>
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
