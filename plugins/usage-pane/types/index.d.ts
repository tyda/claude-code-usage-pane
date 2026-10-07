export type Tick = number

// Main-loop turn usage summed since the pane began counting in the session started at `startedAt`.
export type SessionTotals = { startedAt: number; input: number; output: number; turns: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-pane': { tick: Tick; totals: SessionTotals | null }
  }
}
