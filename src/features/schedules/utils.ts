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
  // custom_shifts' per-shift repeat rules — only present for that cycle
  // type. See `expandRotatePatternDays` below for how `frequency`/
  // `weekdays` now actually shape the calendar (weekly only, for now).
  shift_repeat?: {
    shift_id: string
    frequency: string
    weekdays?: string[]
  }[]
  end_settings?: {
    end_type?: string
    end_date?: string
    end_occurrences?: number
  }
}

// A single pattern card's real-day span: 7 for a card whose shift has a
// matching `weekly`-frequency `shift_repeat` entry, 1 for everything else
// (off cards, daily/monthly-frequency cards, or — critically — cards with
// no matching `shift_repeat` entry at all, which is what keeps
// `pattern_shifts` mode, which never populates `shift_repeat`, on today's
// plain one-card-one-day behavior with no special-casing needed).
function getCardDayCount(
  entry: { shift_id?: string; is_off: boolean },
  shiftRepeatByShiftId: Map<string, { frequency: string }>
): 1 | 7 {
  const isWeekly =
    !entry.is_off &&
    !!entry.shift_id &&
    shiftRepeatByShiftId.get(entry.shift_id)?.frequency === 'weekly'
  return isWeekly ? 7 : 1
}

function buildShiftRepeatMap(
  shiftRepeat: { shift_id: string; frequency: string; weekdays?: string[] }[]
) {
  return new Map(shiftRepeat.map((r) => [r.shift_id, r]))
}

// Total real calendar days one full pass through a rotate pattern spans.
// Weekday content is irrelevant to the count (a weekly card always
// contributes exactly 7 regardless of which weekdays end up active within
// it), so this needs no date/weekday input at all.
function getRotatePatternDayCount(
  pattern: { position: number; shift_id?: string; is_off: boolean }[],
  shiftRepeat: { shift_id: string; frequency: string; weekdays?: string[] }[]
): number {
  const shiftRepeatByShiftId = buildShiftRepeatMap(shiftRepeat)
  return [...pattern]
    .sort((a, b) => a.position - b.position)
    .reduce((sum, entry) => sum + getCardDayCount(entry, shiftRepeatByShiftId), 0)
}

// Expands a custom_shifts pattern (fixed-count, auto-populated cards) into
// real calendar-day units. A `daily`-frequency card (or an off card, or a
// card with no matching `shift_repeat` entry — see `getCardDayCount`) stays
// exactly 1 day, always active if it has a shift — bit-for-bit today's
// behavior. A `weekly`-frequency card instead spans 7 real days, active
// only on that shift's own selected weekdays; the other days in that card's
// week are unassigned/off. `monthly` is explicitly out of scope for now and
// falls through the same 1-day path as `daily`.
//
// `startDate` only determines which real weekday each expanded day within a
// weekly card lands on — the running day-offset from `startDate` is read
// off the output array's own length as it's built, since every prior card
// has already pushed its exact day-contribution by the time a later card is
// expanded.
type ExpandedRotateDay = {
  shiftId: string | undefined
  isOff: boolean
  // True when this day came from a weekly-frequency card's 7-day
  // expansion — the real weekday is then meaningful (consistent across
  // cycles), so the caller can read the shift's actual per-weekday hours
  // instead of falling back to a generic summary.
  fromWeeklyCard: boolean
}

function expandRotatePatternDays(
  pattern: { position: number; shift_id?: string; is_off: boolean }[],
  shiftRepeat: { shift_id: string; frequency: string; weekdays?: string[] }[],
  startDate: Date
): ExpandedRotateDay[] {
  const shiftRepeatByShiftId = buildShiftRepeatMap(shiftRepeat)
  const sortedPattern = [...pattern].sort((a, b) => a.position - b.position)
  const days: ExpandedRotateDay[] = []

  for (const entry of sortedPattern) {
    const repeat = entry.shift_id
      ? shiftRepeatByShiftId.get(entry.shift_id)
      : undefined

    if (entry.is_off || !entry.shift_id || repeat?.frequency !== 'weekly') {
      days.push({
        shiftId: entry.is_off ? undefined : entry.shift_id,
        isOff: entry.is_off || !entry.shift_id,
        fromWeeklyCard: false,
      })
      continue
    }

    const activeWeekdays = new Set(repeat.weekdays ?? [])
    for (let i = 0; i < 7; i++) {
      const weekdayCode = format(
        addDays(startDate, days.length),
        'EEE'
      ).toLowerCase()
      const isActive = activeWeekdays.has(weekdayCode)
      days.push({
        shiftId: isActive ? entry.shift_id : undefined,
        isOff: !isActive,
        fromWeeklyCard: true,
      })
    }
  }

  return days
}

// Rotate's own real-day pattern length (see `getRotatePatternDayCount` —
// weekly cards expand to 7 real days each), or a plain calendar week for
// fixed/flexible.
export function getScheduleCycleLength(schedule: CalendarScheduleInput): number {
  if (schedule.type === 'rotate') {
    return getRotatePatternDayCount(
      schedule.pattern ?? [],
      schedule.shift_repeat ?? []
    )
  }
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

// The calendar preview never renders more than one page's worth of days at
// once, even if the schedule's own cycle (e.g. a long rotate pattern) is
// longer than this — `cycleLength` (used for "Next cycle" paging and
// `end_settings` capping) stays the real, uncapped length regardless; only
// the materialized `days` array is capped.
const MAX_CALENDAR_PREVIEW_DAYS = 28

// Builds one page ("cycle") of a regular schedule's real-date calendar —
// `cycleIndex` 0 is the cycle starting at `start_date` itself, 1 is the
// next `cycleLength`-day block after that, etc. (never before `start_date`).
//
// - rotate: `pattern`'s own card order is exactly what shows up on the
//   calendar, in that order, starting at `start_date` — but a card's real
//   calendar-day span now depends on its shift's own `shift_repeat` rule
//   (see `expandRotatePatternDays`): a `daily`-frequency card (or an off
//   card, or a card whose shift has no `shift_repeat` entry — which is
//   exactly `pattern_shifts` mode, since it never populates `shift_repeat`)
//   is still a single day, always active, same as before. A
//   `weekly`-frequency card instead spans a real calendar week, active only
//   on that shift's own selected weekdays — the other days of that card's
//   week are off. `monthly` is explicitly out of scope for now and stays
//   1-day-per-card, same as `daily`. A shift's displayed time range uses
//   its real per-weekday hours when the active day came from a
//   weekly-expanded card (we know the specific weekday); otherwise it falls
//   back to a representative summary (`getShiftTimeRange`, the same helper
//   the shifts table uses for its Start/End columns), since a daily/monthly
//   card still places a whole shift on an arbitrary cycle day, not a
//   specific weekday.
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
  const pattern = schedule.pattern ?? []
  const cycleStart = addDays(startDate, cycleIndex * cycleLength)

  const resolvedShifts = (schedule.shift_ids ?? [])
    .map((id) => shifts.find((s) => s.id === id))
    .filter((s): s is Shift => s !== undefined)

  // Computed once per call (not per date) — the same expanded sequence
  // repeats every full cycle, so there's no need to re-derive it per day.
  const expandedDays =
    schedule.type === 'rotate'
      ? expandRotatePatternDays(pattern, schedule.shift_repeat ?? [], startDate)
      : []

  const days: ScheduleCalendarDay[] = Array.from(
    { length: Math.min(cycleLength, MAX_CALENDAR_PREVIEW_DAYS) },
    (_, i) => {
      const date = addDays(cycleStart, i)
      const date_str = format(date, 'yyyy-MM-dd')
      // Date#getDay(): 0 = Sunday .. 6 = Saturday -> shift to Monday-first.
      const weekdayIndex = (date.getDay() + 6) % 7

      if (schedule.type === 'rotate') {
        const offsetDays = differenceInCalendarDays(date, startDate)
        // 0-indexed — `expandedDays` is a plain array, not `pattern`'s own
        // 1-based `position` field.
        const dayInCycle = ((offsetDays % cycleLength) + cycleLength) % cycleLength
        const expanded = expandedDays[dayInCycle]
        const shift = expanded?.shiftId
          ? shifts.find((s) => s.id === expanded.shiftId)
          : undefined
        // Re-derived, not just `expanded?.isOff` — a card pointing at a
        // since-deleted shift must still resolve to off here, even if its
        // weekday was otherwise active.
        const isOff = !expanded || expanded.isOff || !shift
        const weekdayCode = format(date, 'EEE').toLowerCase() as ShiftDayOfWeek
        const perWeekdayTimes = expanded?.fromWeeklyCard
          ? shift?.days.find((d) => d.day === weekdayCode)?.times
          : undefined
        const range = shift ? getShiftTimeRange(shift.days) : null

        return {
          date,
          date_str,
          weekdayIndex,
          isOff,
          entries:
            !isOff && shift
              ? [
                  {
                    shift,
                    times:
                      perWeekdayTimes?.length
                        ? perWeekdayTimes
                        : range
                          ? [range]
                          : [],
                  },
                ]
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
