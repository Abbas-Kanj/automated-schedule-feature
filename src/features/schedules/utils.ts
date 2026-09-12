import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  getDaysInMonth,
  parse,
  startOfMonth,
} from 'date-fns'
import {
  type DayOfWeek as ShiftDayOfWeek,
  type Shift,
} from '@/features/shifts/data/schema'
import { getShiftTimeRange } from '@/features/shifts/utils'
import { CYCLE_TYPE_OPTIONS } from './data/data'
import {
  type DayOfWeek,
  type EndSettings,
  type Schedule,
  type TimeRange,
} from './data/schema'

// "Never ends" / "After 4 occurrence(s)" / "On 2026-09-01" as one line —
// the three end-settings shapes never coexist, so they don't need three
// separate rows. Shared by the wizard's Summary step and the Schedule
// Rotation screen, which is where a rotation's end is now edited.
export function formatEndSettings(
  endSettings: EndSettings | undefined
): string | undefined {
  if (!endSettings?.end_type) return undefined
  if (endSettings.end_type === 'after_occurrences') {
    return endSettings.end_occurrences
      ? `After ${endSettings.end_occurrences} occurrence(s)`
      : undefined
  }
  if (endSettings.end_type === 'on_date') {
    return endSettings.end_date ? `On ${endSettings.end_date}` : undefined
  }
  return 'Never ends'
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

// The schedule's own shifts, resolved and in its own order. Ids with no shift
// behind them are dropped — a since-deleted shift contributes no hours.
function resolveShifts(shiftIds: string[], shifts: Shift[]): Shift[] {
  const byId = new Map(shifts.map((shift) => [shift.id, shift]))
  return shiftIds.flatMap((id) => {
    const shift = byId.get(id)
    return shift ? [shift] : []
  })
}

function enabledDayHours(shift: Shift): number {
  return shift.days
    .filter((day) => day.enabled)
    .reduce((sum, day) => sum + calculateHours(day.times), 0)
}

// Shared "09:00–17:00, 18:00–20:00" formatter for a list of time ranges.
// `formatTime` is the caller's bound `useTimeFormat()` formatter — 12h/24h is a
// display preference, not something this pure function decides.
export function formatTimes(
  times: { from_time: string; to_time: string }[] | undefined,
  formatTime: (time: string) => string
): string {
  if (!times?.length) return '—'
  return times
    .map((t) => `${formatTime(t.from_time)}–${formatTime(t.to_time)}`)
    .join(', ')
}

export function getScheduleTotalHours(
  schedule: Schedule,
  shifts: Shift[]
): number {
  if (schedule.parent_type === 'regular') {
    if (schedule.type === 'rotate') {
      // A pattern card points at one of the schedule's own selected shifts, so
      // the hours are that shift's, averaged over the cycle.
      const byId = new Map(shifts.map((shift) => [shift.id, shift]))
      const activeHours = schedule.pattern.reduce((sum, entry) => {
        if (entry.is_off || !entry.shift_id) return sum
        const shift = byId.get(entry.shift_id)
        return shift ? sum + enabledDayHours(shift) : sum
      }, 0)
      return Math.round((activeHours / schedule.cycle_length.days) * 100) / 100
    }

    return resolveShifts(schedule.shift_ids, shifts).reduce(
      (sum, shift) => sum + enabledDayHours(shift),
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

export function getScheduleSummary(
  schedule: Schedule,
  shifts: Shift[]
): string {
  if (schedule.parent_type === 'regular') {
    if (schedule.type === 'rotate') {
      const cycleLabel = CYCLE_TYPE_OPTIONS.find(
        (o) => o.value === schedule.cycle_type
      )?.label
      return `${cycleLabel} · ${schedule.cycle_length.days}-day cycle`
    }

    const resolvedShifts = resolveShifts(schedule.shift_ids, shifts)
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
// Maps a fixed/flexible/rotate schedule onto actual calendar dates, one cycle
// (page) at a time. A cycle is the schedule's own repeat unit: rotate's pattern
// length, or a plain calendar week for fixed/flexible, whose selected shifts'
// `days` simply repeat every 7 days with no pattern to cycle through.

export type ScheduleCalendarEntry = {
  shift: Shift
  times: { from_time: string; to_time: string; overnight?: boolean }[]
}

export type ScheduleCalendarDay = {
  date: Date
  date_str: string
  // Monday-first (0 = Monday .. 6 = Sunday), matching the weekday chips
  // elsewhere in the app — not this file's own Sunday-first `DAYS_OF_WEEK`.
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

// Loose shape on purpose: the Summary step reads these off the live, possibly
// still-incomplete form values via `useWatch` rather than a validated
// `Schedule`, so every field stays optional.
export type CalendarScheduleInput = {
  type?: 'fixed' | 'flexible' | 'rotate'
  start_date?: string
  shift_ids?: string[]
  pattern?: { position: number; shift_id?: string; is_off: boolean }[]
  // custom_shifts' per-shift repeat rules — only present for that cycle type.
  // See `expandRotatePatternDays` for how `frequency`/`weekdays` shape the
  // calendar (weekly only, for now).
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

// A pattern card's real-day span: 7 for a card whose shift has a matching
// `weekly`-frequency repeat entry, 1 for everything else — off cards,
// daily/monthly cards, and cards with no repeat entry at all, which is what
// keeps `pattern_shifts` mode on one-card-one-day with no special case.
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

// Total real calendar days one full pass through a rotate pattern spans. A
// weekly card always contributes 7 whatever weekdays are active inside it, so
// this needs no date input.
function getRotatePatternDayCount(
  pattern: { position: number; shift_id?: string; is_off: boolean }[],
  shiftRepeat: { shift_id: string; frequency: string; weekdays?: string[] }[]
): number {
  const shiftRepeatByShiftId = buildShiftRepeatMap(shiftRepeat)
  return [...pattern]
    .sort((a, b) => a.position - b.position)
    .reduce(
      (sum, entry) => sum + getCardDayCount(entry, shiftRepeatByShiftId),
      0
    )
}

// Expands a custom_shifts pattern into real calendar-day units. A daily card
// (or an off card, or one with no repeat entry) stays a single day, always
// active if it has a shift. A weekly card spans 7 real days, active only on
// that shift's own selected weekdays. `monthly` is out of scope for now and
// takes the same 1-day path as `daily`.
//
// `startDate` only decides which real weekday each expanded day lands on; the
// running offset is read off the output array's length as it is built, since
// every prior card has already pushed its exact contribution.
type ExpandedRotateDay = {
  shiftId: string | undefined
  isOff: boolean
  // True when this day came from a weekly card's 7-day expansion, which is when
  // the real weekday is meaningful — the caller can then read the shift's
  // actual per-weekday hours instead of a generic summary.
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

// Rotate's real-day pattern length (weekly cards expand to 7 days each), or a
// plain calendar week for fixed/flexible.
export function getScheduleCycleLength(
  schedule: CalendarScheduleInput
): number {
  if (schedule.type === 'rotate') {
    return getRotatePatternDayCount(
      schedule.pattern ?? [],
      schedule.shift_repeat ?? []
    )
  }
  return 7
}

// True once `cycleIndex`'s cycle is the last one `end_settings` allows.
// `after_occurrences` reads as "N repeats of the cycle" — N weeks for
// fixed/flexible, N pattern repeats for rotate — the only unit meaningful to
// both.
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

// The preview never renders more than one page of days, however long the cycle
// is. `cycleLength` stays the real, uncapped length — only `days` is capped.
const MAX_CALENDAR_PREVIEW_DAYS = 28

// Builds one page ("cycle") of a regular schedule's real-date calendar.
// `cycleIndex` 0 is the cycle starting at `start_date`, 1 the next
// `cycleLength`-day block, and so on — never before `start_date`.
//
// - rotate: the pattern's card order is what shows on the calendar, starting at
//   `start_date`, each card spanning the days `expandRotatePatternDays` gives
//   it. A weekly-expanded day shows the shift's real per-weekday hours, since
//   the weekday is known; anything else falls back to `getShiftTimeRange`,
//   because a daily card places a shift on a cycle day, not a weekday.
// - fixed/flexible: each selected shift's own `days` entry for that weekday,
//   with its exact hours, and more than one shift may be active the same day.
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

  // Once per call, not per date: the same expanded sequence repeats every cycle.
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
        const dayInCycle =
          ((offsetDays % cycleLength) + cycleLength) % cycleLength
        const expanded = expandedDays[dayInCycle]
        const shift = expanded?.shiftId
          ? shifts.find((s) => s.id === expanded.shiftId)
          : undefined
        // Re-derived rather than trusting `expanded.isOff`: a card pointing at
        // a since-deleted shift must still read as off.
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
                    times: perWeekdayTimes?.length
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
          return dayEntry?.enabled ? [{ shift, times: dayEntry.times }] : []
        }
      )

      return {
        date,
        date_str,
        weekdayIndex,
        isOff: entries.length === 0,
        entries,
      }
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

// The cycle day a crew starts on, in the units the pattern was written in.
// "Week 2" is the phrase the real-world write-ups use, so it is said out loud
// rather than left as arithmetic on a day number. Lives here so the schedule
// form and the Schedule Rotation screen read a crew's start the same way.
export function describeStartDay(day: number, cycleLength: number): string {
  if (cycleLength > 7 && cycleLength % 7 === 0) {
    return `Day ${day + 1} · week ${Math.floor(day / 7) + 1}`
  }
  return `Day ${day + 1}`
}
