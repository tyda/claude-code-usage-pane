import type { ClientModule } from 'claude-code'

const FRAME_MS = 200
const GAP = '   ·   '

export type MarqueeProps = { text: string; width: number }

// East Asian wide and fullwidth characters take two terminal cells.
const cells = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0
  return (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
    ? 2
    : 1
}

export function frame(text: string, width: number, t: number) {
  const chars = Array.from(text + GAP)
  let out = ''
  let used = 0
  for (let i = 0; ; i++) {
    const ch = chars[(t + i) % chars.length]
    const w = cells(ch)
    if (used + w > width) break
    out += ch
    used += w
  }
  return out + ' '.repeat(width - used)
}

const Marquee: ClientModule<MarqueeProps, number> = (props, s) => {
  const { Text } = s.elements
  if (s.state === undefined) {
    let t = 0
    s.every(FRAME_MS, () => s.setState(++t))
  }

  return <Text color="warning">{frame(props.text, props.width, s.state ?? 0)}</Text>
}

export default Marquee
