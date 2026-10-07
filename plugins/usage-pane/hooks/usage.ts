export type Severity = 'NORMAL' | 'WARNING' | 'CRITICAL'

export const severity = (pct: number): Severity => (pct >= 90 ? 'CRITICAL' : pct >= 70 ? 'WARNING' : 'NORMAL')

const SEVERITY_COLOR = { NORMAL: 'success', WARNING: 'warning', CRITICAL: 'error' } as const

export const tone = (pct: number) => SEVERITY_COLOR[severity(pct)]

export const remaining = (used: number) => Math.max(0, Math.round((100 - used) * 10) / 10)
