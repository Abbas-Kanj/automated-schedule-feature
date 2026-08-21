import { type PolicyRule } from './data/schema'

// Formats a duration in minutes as a compact "Xh Ym" string — the rule
// result readout's format, e.g. 90 -> "1h 30m", 120 -> "2h", 45 -> "45m".
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// A blank rule row — 1x factor over an hour, booked as presence. Mirrors
// the "sensible default rather than empty inputs" approach the shift
// form's break rows take.
export function buildDefaultRule(id: string): PolicyRule {
  return {
    id,
    name: '',
    from_time: '09:00',
    to_time: '10:00',
    factor: 1,
    attendance_type: 'presence',
  }
}
