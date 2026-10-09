import type { ClientModule } from 'claude-code'

const FRAME_MS = 150
const W = 21
const MID = 10
const CANOPY_HALF = [3, 6, 8, 9, 9, 8, 5]
const LEAF = '@'
const RUSTLE = ['&', '%', '8']
const GUST_PERIOD = 40
const GUST_LEAD = 6
const LEAF_RELEASE = 18
const LEAF_LIFE = 16
const APPLES = [
  { r: 2, c: MID - 4, period: 150, offset: 60 },
  { r: 3, c: MID + 5, period: 190, offset: 30 },
  { r: 4, c: MID - 6, period: 170, offset: 100 },
  { r: 5, c: MID + 4, period: 210, offset: 0 },
]
const APPLE_BUD = 10
const APPLE_RIPE = 25
const APPLE_ON_GROUND = 25
const APPLE_GONE = 15
const ROOTS = '_/|\\_'
const GRASS = ',.\'.,;.,\'.,.;,.\',.,;.'

type Cell = { ch: string; color?: string; dim?: boolean; bold?: boolean }

const hash = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

const blank = (): Cell[] => Array.from({ length: W }, () => ({ ch: ' ' }))

function scene(t: number): Cell[][] {
  const phase = t % GUST_PERIOD
  const gust = phase - GUST_LEAD
  const gusting = gust >= 0 && gust <= W
  const rows: Cell[][] = []

  CANOPY_HALF.forEach((half, r) => {
    const row = blank()
    const lean = r < 2 && gust > 4 && gust < 16 ? 1 : 0
    for (let c = MID - half; c <= MID + half; c++) {
      const x = c + lean
      const inGust = gusting && Math.abs(c - gust + r * 0.5) < 1.5
      const rustle = hash(r, c, t) % 29 === 0
      const shade = hash(r, c) % 4 === 0
      row[x] =
        inGust || rustle
          ? { ch: RUSTLE[hash(r, c, t >> 1) % RUSTLE.length], color: 'success', bold: inGust }
          : { ch: LEAF, color: 'success', dim: shade }
    }
    rows.push(row)
  })

  const trunk = blank()
  trunk[MID - 1] = { ch: '\\', color: 'warning' }
  trunk[MID] = { ch: '|', color: 'warning' }
  trunk[MID + 1] = { ch: '/', color: 'warning' }
  rows.push(trunk)

  const stem = blank()
  stem[MID] = { ch: '|', color: 'warning' }
  rows.push(stem)

  const ground = Array.from({ length: W }, (_, c): Cell => ({ ch: GRASS[c], dim: true }))
  for (let i = 0; i < ROOTS.length; i++) ground[MID - 2 + i] = { ch: ROOTS[i], color: 'warning' }
  rows.push(ground)

  const groundRow = rows.length - 1
  for (const a of APPLES) {
    const p = (t + a.offset) % a.period
    const drop = a.period - APPLE_ON_GROUND - APPLE_GONE
    if (p < APPLE_BUD) rows[a.r][a.c] = { ch: '.', color: 'success', bold: true }
    else if (p < APPLE_RIPE) rows[a.r][a.c] = { ch: 'o', color: 'warning' }
    else if (p < drop) rows[a.r][a.c] = { ch: 'o', color: 'error', bold: true }
    else if (p < a.period - APPLE_GONE) rows[Math.min(a.r + p - drop, groundRow)][a.c] = { ch: 'o', color: 'error', bold: true }
  }

  const k = phase - LEAF_RELEASE
  if (k >= 0 && k < LEAF_LIFE) {
    const top = CANOPY_HALF.length
    const r = Math.min(top + Math.floor(k / 3), rows.length - 1)
    const landed = r === rows.length - 1
    const c = Math.min(W - 1, MID + 6 + Math.floor(Math.min(k, 9) / 2) + (landed ? 0 : Math.round(Math.sin(k))))
    rows[r][c] = { ch: landed ? '.' : '*', color: landed ? 'warning' : 'success', bold: !landed }
  }

  return rows
}

const same = (a: Cell, b: Cell) => a.color === b.color && !!a.dim === !!b.dim && !!a.bold === !!b.bold

const Tree: ClientModule<null, number> = (_props, s) => {
  const { Box, Text } = s.elements
  if (s.state === undefined) {
    let t = 0
    s.every(FRAME_MS, () => s.setState(++t))
  }

  return (
    <Box flexDirection="column">
      {scene(s.state ?? 0).map((row, i) => {
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
