import { differenceInMinutes, parse } from 'date-fns'
import { DAYS_OF_WEEK, type DayTimeEntry, type TimeRangeEntry } from './data/schema'

export function generateId() {
  return crypto.randomUUID()
}

export function deriveShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 6).toUpperCase()
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 6)
    .toUpperCase()
}

export function calculateShiftHours(
  from_time: string,
  to_time: string,
  overnight?: boolean
): number {
  if (!from_time || !to_time) return 0
  const from = parse(from_time, 'HH:mm', new Date())
  const to = parse(to_time, 'HH:mm', new Date())
  const diff = differenceInMinutes(to, from)
  // A range that ends before it starts (e.g. an overnight 22:00 -> 06:00
  // entry) is treated as crossing midnight rather than a negative duration.
  const totalMinutes = overnight || diff < 0 ? diff + 24 * 60 : diff

  return Math.round((totalMinutes / 60) * 100) / 100
}

// Builds a fresh Mon–Sun set of day entries, all sharing the same single
// time range and enabled state — the starting point for both the "same
// hours" and "different hours" dialogs.
export function buildDefaultDays(
  time: Pick<TimeRangeEntry, 'from_time' | 'to_time' | 'overnight'>,
  enabled = true
): DayTimeEntry[] {
  return DAYS_OF_WEEK.map((day) => ({ day, enabled, times: [{ ...time }] }))
}

const BREAK_DURATION_STEPS_MINUTES = [5, 10, 15, 20, 30, 45, 60, 90, 120]

// Duration choices for a break entry, bounded by its own from/to span —
// e.g. a 09:00–09:45 window only offers the 5..45 minute steps.
export function getBreakDurationOptions(
  from_time: string,
  to_time: string
): number[] {
  if (!from_time || !to_time || !(to_time > from_time)) return []
  const span = differenceInMinutes(
    parse(to_time, 'HH:mm', new Date()),
    parse(from_time, 'HH:mm', new Date())
  )
  return BREAK_DURATION_STEPS_MINUTES.filter((minutes) => minutes <= span)
}

// A single start/end range to summarize a shift's week for table display:
// the earliest enabled time's start and the latest enabled time's end,
// across every day and every time range on it. Days (and ranges within a
// day) can disagree, so this is a summary, not a promise every one of them
// matches it exactly.
export function getShiftTimeRange(
  days: DayTimeEntry[]
): { from_time: string; to_time: string } | null {
  const times = days.filter((d) => d.enabled).flatMap((d) => d.times)
  if (!times.length) return null

  const from_time = times.reduce(
    (min, t) => (t.from_time < min ? t.from_time : min),
    times[0].from_time
  )
  const to_time = times.reduce(
    (max, t) => (t.to_time > max ? t.to_time : max),
    times[0].to_time
  )
  return { from_time, to_time }
}
