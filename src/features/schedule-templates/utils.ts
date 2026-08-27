import { toMinutes } from '@/lib/time'

// Length of the daily window in minutes. A `to_time` at or before
// `from_time` reads as crossing midnight, so it wraps to the next day
// rather than going negative — same rule as `shifts`' `getTimeRangeSpan`.
export function getDurationMinutes(fromTime: string, toTime: string): number {
  const from = toMinutes(fromTime)
  const to = toMinutes(toTime)
  return to > from ? to - from : 24 * 60 - from + to
}

// "8 hours", "45 minutes", "7 hours 30 minutes".
export function formatDuration(fromTime: string, toTime: string): string {
  const duration = getDurationMinutes(fromTime, toTime)
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60

  const hoursLabel = `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const minutesLabel = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`

  if (!hours) return minutesLabel
  if (!minutes) return hoursLabel
  return `${hoursLabel} ${minutesLabel}`
}
