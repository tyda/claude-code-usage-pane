import type { ClientModule } from 'claude-code'

const FRAME_MS = 400
const CANOPY = ['   .@@@.   ', '  @@@@@@@  ', ' @@@@@@@@@ ', '  @@@@@@@  ']
const TRUNK = ['    \\|/    ', '     |     ']
const GROUND = ' ~~~~~~~~~ '
const SWAY = [0, 0, 1, 1, 0, 0, -1, -1]
const LEAF_PATH = [
  [2, 10],
  [3, 10],
  [4, 9],
  [5, 8],
  [6, 9],
]
const LEAF_EVERY = 16

const shift = (row: string, by: number) => (by > 0 ? ' ' + row.slice(0, -1) : by < 0 ? row.slice(1) + ' ' : row)

const Tree: ClientModule<null, number> = (_props, s) => {
  const { Box, Text } = s.elements
  if (s.state === undefined) {
    let t = 0
    s.every(FRAME_MS, () => s.setState(++t))
  }
  const t = s.state ?? 0
  const sway = SWAY[t % SWAY.length]
  const leafStep = t % LEAF_EVERY
  const leaf = leafStep < LEAF_PATH.length ? LEAF_PATH[leafStep] : null

  const rows = [
    ...CANOPY.map(r => ({ text: shift(r, sway), color: 'success' })),
    ...TRUNK.map(r => ({ text: r, color: 'warning' })),
    { text: GROUND, color: undefined },
  ]

  return (
    <Box flexDirection="column">
      {rows.map(({ text, color }, i) => {
        if (leaf && leaf[0] === i) {
          const [, x] = leaf
          return (
            <Text key={String(i)}>
              <Text color={color} dimColor={!color}>{text.slice(0, x)}</Text>
              <Text color="success">*</Text>
              <Text color={color} dimColor={!color}>{text.slice(x + 1)}</Text>
            </Text>
          )
        }
        return (
          <Text key={String(i)} color={color} dimColor={!color}>
            {text}
          </Text>
        )
      })}
    </Box>
  )
}

export default Tree
