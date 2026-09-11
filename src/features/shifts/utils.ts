import { differenceInMinutes, parse } from 'date-fns'
import {
  DAYS_OF_WEEK,
  type DayTimeEntry,
  type ShiftFormValues,
  type TimeRangeEntry,
} from './data/schema'

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

export function calculateShiftHours(from_time: string, to_time: string): number {
  if (!from_time || !to_time) return 0
  const from = parse(from_time, 'HH:mm', new Date())
  const to = parse(to_time, 'HH:mm', new Date())
  const diff = differenceInMinutes(to, from)
  // A range that ends before it starts (e.g. an overnight 22:00 -> 06:00
  // entry) is treated as crossing midnight rather than a negative duration.
  // This is purely a "does the clock wrap" check — it doesn't take the
  // `overnight` flag as an input, since a range that already ends after it
  // starts (09:00 -> 17:00) isn't spanning an extra day just because its
  // `overnight` flag happens to be set (see `ShiftTimesTab`'s "Overnight"
  // category handling, which forces that flag on regardless of the times
  // actually chosen).
  const totalMinutes = diff < 0 ? diff + 24 * 60 : diff

  return Math.round((totalMinutes / 60) * 100) / 100
}

// Formats a decimal-hours duration (as returned by `calculateShiftHours`)
// as a compact "Xh Ym" string for the "Shift times" tab's same-hours
// duration readout, e.g. 8.5 -> "8h 30m", 8 -> "8h".
export function formatDurationHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Builds a fresh Mon–Sun set of day entries, all sharing the same single
// time range and enabled state — the starting point for the "Shift times"
// tab's same-hours and different-hours modes.
export function buildDefaultDays(
  time: Pick<TimeRangeEntry, 'from_time' | 'to_time' | 'overnight'>,
  enabled = true
): DayTimeEntry[] {
  return DAYS_OF_WEEK.map((day) => ({ day, enabled, times: [{ ...time }] }))
}

// A break entry's own from/to span in minutes — the ceiling its
// user-entered `duration_minutes` isn't allowed to exceed (see
// `shiftFieldsSchema`'s `superRefine` and `ShiftTimesTab`'s live check).
// 0 for an invalid (non-increasing) range rather than a negative number.
export function getBreakSpanMinutes(from_time: string, to_time: string): number {
  if (!from_time || !to_time || !(to_time > from_time)) return 0
  return differenceInMinutes(
    parse(to_time, 'HH:mm', new Date()),
    parse(from_time, 'HH:mm', new Date())
  )
}

// Formats a duration in minutes as "H:MM" — the break-time duration
// input's display format (see `ShiftTimesTab`'s break rows), so users
// enter e.g. "1:30" instead of 90 raw minutes.
export function formatDurationHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

// Inverse of `formatDurationHM` — returns undefined for anything that
// isn't a complete, valid "H:MM" string (partial typing, e.g. "1:"), so
// callers can leave the field's own text alone until it parses.
export function parseDurationHM(text: string): number | undefined {
  const match = /^(\d{1,3}):([0-5]?\d)$/.exec(text.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours * 60 + minutes
}

// Normalizes a submitted form's values before it's written to the store —
// clears out fields whose owning toggle is off rather than persisting
// stale/hidden data. Shared by the "Create shift" page and the "Edit
// shift" dialog (see `pages/create/shift-create-page.tsx` /
// `shift-form-dialog.tsx`).
export function normalizeShiftFormValues(
  values: ShiftFormValues
): ShiftFormValues {
  return {
    ...values,
    // "Local" mode doesn't carry a chosen zone — the shift just follows
    // wherever it's viewed from, so we don't persist a stale snapshot.
    timezone: values.timezone_mode === 'local' ? undefined : values.timezone,
    custom_category:
      values.category === 'custom' ? values.custom_category : undefined,
    repeat: values.repeat_enabled ? values.repeat : {},
    breaks: values.break_enabled ? values.breaks : [],
    work_type_group: values.assign_to_enabled
      ? values.work_type_group
      : undefined,
    service_resource: values.assign_to_enabled
      ? values.service_resource
      : undefined,
    service_territory: values.assign_to_enabled
      ? values.service_territory
      : undefined,
    employee_ids: values.assign_to_enabled ? values.employee_ids : [],
    team_ids: values.assign_to_enabled ? values.team_ids : [],
  }
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
