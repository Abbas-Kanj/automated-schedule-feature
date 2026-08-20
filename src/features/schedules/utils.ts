import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  getDaysInMonth,
  parse,
  startOfMonth,
} from 'date-fns'
import { CYCLE_TYPE_OPTIONS } from './data/data'
import { type DayOfWeek, type Schedule, type TimeRange } from './data/schema'
import {
  type DayOfWeek as ShiftDayOfWeek,
  type Shift,
} from '@/features/shifts/data/schema'
import { getShiftTimeRange } from '@/features/shifts/utils'

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

export function calculateHours(times: TimeRange[]): number {
  const totalMinutes = times.reduce((sum, t) => {
    if (!t.from_time || !t.to_time) return sum
    const from = parse(t.from_time, 'HH:mm', new Date())
    const to = parse(t.to_time, 'HH:mm', new Date())
    const diff = differenceInMinutes(to, from)
    // A range that ends before it starts (e.g. an overnight 22:00 -> 06:00
    // entry) is treated as crossing midnight rather than a negative duration.
    return sum + (diff >= 0 ? diff : diff + 24 * 60)
  }, 0)

  return Math.round((totalMinutes / 60) * 100) / 100
}

export type MonthDay = {
  date: Date
  date_str: string
  weekday: DayOfWeek
}

export function getDaysOfMonth(year: number, month: number): MonthDay[] {
  const monthStart = startOfMonth(new Date(year, month - 1))
  const count = getDaysInMonth(monthStart)

  return Array.from({ length: count }, (_, i) => {
    const date = addDays(monthStart, i)
    return {
      date,
      date_str: format(date, 'yyyy-MM-dd'),
      weekday: format(date, 'EEEE').toLowerCase() as DayOfWeek,
    }
  })
}

export function getDaysInMonthArray(year: number, month: number) {
  const count = getDaysInMonth(new Date(year, month - 1))
  return Array.from({ length: count }, (_, i) => i + 1)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// Shared "09:00–17:00, 18:00–20:00" formatter for a list of time ranges —
// used by the Summary step's per-day listings and its calendar preview
// (`schedule-calendar-preview.tsx`) alike. `formatTime` is the caller's
// bound `useTimeFormat()` formatter (12h/24h is a user display
// preference, not something this pure function decides).
export function formatTimes(
  times: { from_time: string; to_time: string }[] | undefined,
  formatTime: (time: string) => string
): string {
  if (!times?.length) return '—'
  return times
    .map((t) => `${formatTime(t.from_time)}–${formatTime(t.to_time)}`)
    .join(', ')
}

export function getScheduleTotalHours(schedule: Schedule, shifts: Shift[]): number {
  if (schedule.parent_type === 'regular') {
    if (schedule.type === 'rotate') {
      // Each pattern day now points at one of the schedule's own selected
      // shifts (`shift_id`) rather than a hand-authored block — total hours
      // come from that shift's own enabled-day hours instead.
      const activeHours = schedule.pattern.reduce((sum, p) => {
        if (p.is_off || !p.shift_id) return sum
        const shift = shifts.find((s) => s.id === p.shift_id)
        if (!shift) return sum
        return (
          sum +
          shift.days
            .filter((d) => d.enabled)
            .reduce((daySum, d) => daySum + calculateHours(d.times), 0)
        )
      }, 0)
      return Math.round((activeHours / schedule.cycle_length.days) * 100) / 100
    }

    const resolvedShifts = schedule.shift_ids
      .map((id) => shifts.find((s) => s.id === id))
      .filter((s): s is Shift => s !== undefined)

    return resolvedShifts.reduce(
      (shiftSum, shift) =>
        shiftSum +
        shift.days
          .filter((d) => d.enabled)
          .reduce((daySum, d) => daySum + calculateHours(d.times), 0),
      0
    )
  }

  if (schedule.type === 'weekly' || schedule.type === 'weekly_one') {
    return schedule.days.reduce((sum, d) => sum + calculateHours(d.times), 0)
  }

  return schedule.months.reduce(
    (sum, m) =>
      sum + m.days.reduce((daySum, d) => daySum + calculateHours(d.times), 0),
    0
  )
}

export function getScheduleSummary(schedule: Schedule, shifts: Shift[]): string {
  if (schedule.parent_type === 'regular') {
    if (schedule.type === 'rotate') {
      const cycleLabel = CYCLE_TYPE_OPTIONS.find(
        (o) => o.value === schedule.cycle_type
      )?.label
      return `${cycleLabel} · ${schedule.cycle_length.days}-day cycle`
    }

    const resolvedShifts = schedule.shift_ids
      .map((id) => shifts.find((s) => s.id === id))
      .filter((s): s is Shift => s !== undefined)

    const shiftCount = resolvedShifts.length
    const dayCount = resolvedShifts.reduce(
      (sum, shift) => sum + shift.days.filter((d) => d.enabled).length,
      0
    )
    return `${shiftCount} shift${shiftCount > 1 ? 's' : ''} · ${dayCount} day${dayCount === 1 ? '' : 's'}`
  }

  if (schedule.type === 'weekly') {
    const dayCount = schedule.days.length
    return `Week of ${schedule.week.start_date} to ${schedule.week.end_date} · ${dayCount} day${dayCount > 1 ? 's' : ''}`
  }

  if (schedule.type === 'weekly_one') {
    const dayCount = schedule.days.length
    const dayNames = schedule.days.map((d) => capitalize(d.day)).join(', ')
    return `${dayNames} · ${dayCount} day${dayCount > 1 ? 's' : ''}`
  }

  const monthCount = schedule.months.length
  const dayCount = schedule.months.reduce((sum, m) => sum + m.days.length, 0)
  return `${monthCount} month${monthCount > 1 ? 's' : ''} · ${dayCount} day${dayCount > 1 ? 's' : ''}`
}

// --- regular schedules' real-date calendar preview (Summary step) ---
//
// Maps a fixed/flexible/rotate schedule onto actual calendar dates, one
// "cycle" (page) at a time, for `schedule-calendar-preview.tsx`. A cycle is
// the schedule's own natural repeat unit: rotate's pattern length, or a
// plain calendar week for fixed/flexible (their selected shifts' own
// `days` just repeat every 7 days indefinitely — there's no pattern to
// cycle through).

export type ScheduleCalendarEntry = {
  shift: Shift
  times: { from_time: string; to_time: string; overnight?: boolean }[]
}

export type ScheduleCalendarDay = {
  date: Date
  date_str: string
  // Monday-first index (0 = Monday .. 6 = Sunday) — matches the weekday
  // chip ordering used elsewhere in the app (shifts' own `DAYS_OF_WEEK`,
  // see `shifts/data/schema.ts`), not this file's own Sunday-first
  // `DAYS_OF_WEEK`.
  weekdayIndex: number
  isOff: boolean
  entries: ScheduleCalendarEntry[]
}

export type ScheduleCalendarCycle = {
  days: ScheduleCalendarDay[]
  cycleLength: number
  cycleIndex: number
  canGoToPreviousCycle: boolean
  canGoToNextCycle: boolean
}

// Loose shape accepted below — the Summary step reads these off the live
// (possibly still-incomplete) form values via `useWatch`, not a fully
// validated `Schedule`, so every field stays optional/defensive rather
// than requiring the real discriminated union — same reasoning as this
// file's other `Summary*` components in `schedule-summary.tsx`.
export type CalendarScheduleInput = {
  type?: 'fixed' | 'flexible' | 'rotate'
  start_date?: string
  shift_ids?: string[]
  pattern?: { position: number; shift_id?: string; is_off: boolean }[]
  end_settings?: {
    end_type?: string
    end_date?: string
    end_occurrences?: number
  }
}

// Rotate's own pattern length, or a plain calendar week for fixed/flexible.
export function getScheduleCycleLength(schedule: CalendarScheduleInput): number {
  if (schedule.type === 'rotate') return schedule.pattern?.length ?? 0
  return 7
}

// True once `cycleIndex`'s cycle is the last one the schedule's own
// `end_settings` allows — "never ends" never caps it. `after_occurrences`
// reads as "N repeats of the cycle" (N weeks for fixed/flexible, N pattern
// repeats for rotate) since that's the only unit that stays meaningful
// across both — there's no per-day occurrence count anywhere else in the
// schema to match instead.
function isLastAllowedCycle(
  schedule: CalendarScheduleInput,
  cycleIndex: number,
  cycleStart: Date,
  cycleLength: number
): boolean {
  const endSettings = schedule.end_settings
  if (!endSettings || endSettings.end_type === 'never') return false

  if (endSettings.end_type === 'after_occurrences') {
    if (!endSettings.end_occurrences) return false
    return cycleIndex + 1 >= endSettings.end_occurrences
  }

  if (endSettings.end_type === 'on_date' && endSettings.end_date) {
    const endDate = parse(endSettings.end_date, 'yyyy-MM-dd', new Date())
    const nextCycleStart = addDays(cycleStart, cycleLength)
    return nextCycleStart > endDate
  }

  return false
}

// Builds one page ("cycle") of a regular schedule's real-date calendar —
// `cycleIndex` 0 is the cycle starting at `start_date` itself, 1 is the
// next `cycleLength`-day block after that, etc. (never before `start_date`).
//
// - rotate: a date's pattern position comes from its offset from
//   `start_date`, mod the pattern's own length. A shift's displayed time
//   range is a representative summary (`getShiftTimeRange`, the same
//   helper the shifts table uses for its Start/End columns) rather than
//   that shift's real per-weekday hours — the pattern places a whole shift
//   on an arbitrary cycle day, not a specific weekday, so there's no
//   "correct" weekday to read hours from.
// - fixed/flexible: every selected shift's own `days` entry for that real
//   weekday is used directly (its exact hours, not a summary), and more
//   than one shift can be active the same day.
export function getScheduleCalendarCycle(
  schedule: CalendarScheduleInput,
  shifts: Shift[],
  cycleIndex: number
): ScheduleCalendarCycle {
  const cycleLength = getScheduleCycleLength(schedule)
  if (!schedule.start_date || cycleLength <= 0) {
    return {
      days: [],
      cycleLength,
      cycleIndex,
      canGoToPreviousCycle: false,
      canGoToNextCycle: false,
    }
  }

  const startDate = parse(schedule.start_date, 'yyyy-MM-dd', new Date())
  const cycleStart = addDays(startDate, cycleIndex * cycleLength)
  const pattern = schedule.pattern ?? []

  const resolvedShifts = (schedule.shift_ids ?? [])
    .map((id) => shifts.find((s) => s.id === id))
    .filter((s): s is Shift => s !== undefined)

  const days: ScheduleCalendarDay[] = Array.from(
    { length: cycleLength },
    (_, i) => {
      const date = addDays(cycleStart, i)
      const date_str = format(date, 'yyyy-MM-dd')
      // Date#getDay(): 0 = Sunday .. 6 = Saturday -> shift to Monday-first.
      const weekdayIndex = (date.getDay() + 6) % 7

      if (schedule.type === 'rotate') {
        const offsetDays = differenceInCalendarDays(date, startDate)
        const position =
          ((offsetDays % cycleLength) + cycleLength) % cycleLength + 1
        const patternEntry = pattern.find((p) => p.position === position)
        const shift = patternEntry?.shift_id
          ? shifts.find((s) => s.id === patternEntry.shift_id)
          : undefined
        const isOff = !patternEntry || patternEntry.is_off || !shift
        const range = shift ? getShiftTimeRange(shift.days) : null

        return {
          date,
          date_str,
          weekdayIndex,
          isOff,
          entries:
            !isOff && shift && range
              ? [{ shift, times: [range] }]
              : [],
        }
      }

      // fixed / flexible — every selected shift enabled on this weekday.
      const shiftDayCode = format(date, 'EEE').toLowerCase() as ShiftDayOfWeek
      const entries: ScheduleCalendarEntry[] = resolvedShifts.flatMap(
        (shift) => {
          const dayEntry = shift.days.find((d) => d.day === shiftDayCode)
          return dayEntry?.enabled
            ? [{ shift, times: dayEntry.times }]
            : []
        }
      )

      return { date, date_str, weekdayIndex, isOff: entries.length === 0, entries }
    }
  )

  return {
    days,
    cycleLength,
    cycleIndex,
    canGoToPreviousCycle: cycleIndex > 0,
    canGoToNextCycle: !isLastAllowedCycle(
      schedule,
      cycleIndex,
      cycleStart,
      cycleLength
    ),
  }
}
