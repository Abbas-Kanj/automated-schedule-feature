import { addDays, getDay, parse } from 'date-fns'
import {
  type Occurrence,
  type RotatePatternEntry,
  type ShiftRepeatWeekday,
} from './data/schema'

// date-fns' `getDay` order: 0 is Sunday.
const WEEKDAY_BY_INDEX: ShiftRepeatWeekday[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
]

// A fixed schedule's occurrence rule read as a rotate-style pattern, so the
// "Assign to" step can staff both types with the same component. Card 0 is the
// schedule's start date, which is what that step's weekday warnings assume.
//
// Every working card names the same shift: the suggestion transposes each
// crew's journey through the shift list, so a crew that starts on a shift
// stays on it — which is what makes the schedule fixed rather than rotating.
//
// - daily, every N days: an N-day cycle, working on its first day.
// - weekly, every N weeks: a 7N-day cycle, working the chosen weekdays of its
//   first week. The cycle length is a multiple of both 7 and N, so it repeats
//   exactly.
// - monthly, every N months: a 30N-day cycle — a month is a flat 30 days here,
//   as everywhere else in schedules — working the days of its first 30 that
//   match the rule. Days 1–28 each fall exactly once in any 30-day window, so a
//   day-of-month rule always lands.
export function occurrencePattern(
  occurrence: Occurrence | undefined,
  startDate: string | undefined,
  shiftId: string | undefined
): RotatePatternEntry[] {
  if (!occurrence || !shiftId) return []

  const interval =
    Number.isFinite(occurrence.interval) && occurrence.interval >= 1
      ? Math.floor(occurrence.interval)
      : 1
  const card = (index: number, works: boolean): RotatePatternEntry => ({
    position: index + 1,
    is_off: !works,
    shift_id: works ? shiftId : undefined,
  })

  if (occurrence.frequency === 'daily') {
    return Array.from({ length: interval }, (_, i) => card(i, i === 0))
  }

  const parsed = startDate
    ? parse(startDate, 'yyyy-MM-dd', new Date())
    : new Date()
  const start = Number.isNaN(parsed.getTime()) ? new Date() : parsed

  if (occurrence.frequency === 'weekly') {
    const weekdays = new Set(occurrence.weekdays ?? [])
    return Array.from({ length: 7 * interval }, (_, i) =>
      card(i, i < 7 && weekdays.has(WEEKDAY_BY_INDEX[getDay(addDays(start, i))]))
    )
  }

  return Array.from({ length: DAYS_PER_MONTH * interval }, (_, i) =>
    card(i, i < DAYS_PER_MONTH && matchesMonthly(occurrence, addDays(start, i)))
  )
}

const DAYS_PER_MONTH = 30

function matchesMonthly(occurrence: Occurrence, date: Date): boolean {
  const dayOfMonth = date.getDate()
  switch (occurrence.monthly_mode) {
    case 'day_month':
      return dayOfMonth === occurrence.day_of_month
    case 'date_specific':
      return (
        dayOfMonth === occurrence.date_specific_1 ||
        dayOfMonth === occurrence.date_specific_2
      )
    case 'day_position': {
      // "The 2nd Monday": the right weekday, in the right seven-day band.
      const rule = occurrence.day_position_rules?.[0]
      return (
        !!rule &&
        WEEKDAY_BY_INDEX[getDay(date)] === rule.weekday &&
        Math.ceil(dayOfMonth / 7) === rule.position
      )
    }
    default:
      return false
  }
}
