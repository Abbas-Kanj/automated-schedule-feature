import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
} from 'date-fns'
import {
  type Occurrence,
  type RotatePatternEntry,
  SHIFT_REPEAT_WEEKDAYS,
} from './data/schema'

// What "Work fixed" staffs for a fixed schedule: one card per *working* day the
// occurrence rule describes, and the stable key each card's assignments are
// stored under in `day_coverage.day`.
//
// The keys are deliberately independent of `start_date` — "Team A works
// Tuesdays" must stay Tuesday when the start date is picked (or changed) on
// the later "Start & End" step. They are spaced into separate ranges so an
// assignment can never silently re-attach to a different kind of day when the
// frequency is switched; leaving the Occurrence step prunes keys that no longer
// exist instead.
//
// - daily (every N days): a single slot, key 0.
// - weekly: the chosen weekdays, Monday first, key 1000 + weekday (Mon = 0).
// - monthly, day of month / date specific: key 2000 + (day − 1).
// - monthly, day position ("2nd Monday"): key 3000 + (position − 1) × 7 +
//   weekday.
//
// The interval ("every 2 weeks") changes how often the slots come round, not
// which slots exist, so it plays no part in the keys.
export type OccurrenceSlots = {
  // Every card works `shiftId`; empty until a shift is selected.
  pattern: RotatePatternEntry[]
  slotKeys: number[]
  labels: string[]
}

const WEEKLY_BASE = 1000
const DAY_OF_MONTH_BASE = 2000
const DAY_POSITION_BASE = 3000

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th'
  return `${n}${suffix}`
}

function slotList(
  occurrence: Occurrence
): { key: number; label: string }[] {
  if (occurrence.frequency === 'daily') {
    const interval =
      Number.isFinite(occurrence.interval) && occurrence.interval > 1
        ? Math.floor(occurrence.interval)
        : 1
    return [
      {
        key: 0,
        label: interval === 1 ? 'Every day' : `Every ${interval} days`,
      },
    ]
  }

  if (occurrence.frequency === 'weekly') {
    const chosen = new Set(occurrence.weekdays ?? [])
    return SHIFT_REPEAT_WEEKDAYS.flatMap((weekday, index) =>
      chosen.has(weekday)
        ? [{ key: WEEKLY_BASE + index, label: WEEKDAY_LABELS[index] }]
        : []
    )
  }

  switch (occurrence.monthly_mode) {
    case 'day_month':
    case 'date_specific': {
      const days =
        occurrence.monthly_mode === 'day_month'
          ? [occurrence.day_of_month]
          : [occurrence.date_specific_1, occurrence.date_specific_2]
      const valid = [
        ...new Set(
          days.filter(
            (day): day is number =>
              Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 28
          )
        ),
      ].sort((a, b) => a - b)
      return valid.map((day) => ({
        key: DAY_OF_MONTH_BASE + day - 1,
        label: `Day ${day}`,
      }))
    }
    case 'day_position': {
      const rule = occurrence.day_position_rules?.[0]
      const weekday = rule ? SHIFT_REPEAT_WEEKDAYS.indexOf(rule.weekday) : -1
      if (!rule || weekday < 0 || !Number.isInteger(rule.position)) return []
      return [
        {
          key: DAY_POSITION_BASE + (rule.position - 1) * 7 + weekday,
          label: `${ordinal(rule.position)} ${WEEKDAY_LABELS[weekday]}`,
        },
      ]
    }
    default:
      return []
  }
}

// The slot a calendar day works under, or null when the rule has that day off
// — the other direction from `slotList`, for screens that draw a real
// calendar. `start` anchors the interval: "every 2 weeks" counts from the week
// the schedule starts in. Start and end bounds are the caller's to apply.
export function occurrenceKeyOn(
  occurrence: Occurrence,
  start: Date,
  date: Date
): number | null {
  const interval =
    Number.isFinite(occurrence.interval) && occurrence.interval > 1
      ? Math.floor(occurrence.interval)
      : 1
  const onCadence = (elapsed: number) =>
    ((elapsed % interval) + interval) % interval === 0
  // Monday = 0, matching `SHIFT_REPEAT_WEEKDAYS`.
  const weekday = (date.getDay() + 6) % 7

  if (occurrence.frequency === 'daily') {
    return onCadence(differenceInCalendarDays(date, start)) ? 0 : null
  }

  if (occurrence.frequency === 'weekly') {
    if (!onCadence(differenceInCalendarWeeks(date, start, { weekStartsOn: 1 })))
      return null
    return (occurrence.weekdays ?? []).includes(SHIFT_REPEAT_WEEKDAYS[weekday])
      ? WEEKLY_BASE + weekday
      : null
  }

  if (!onCadence(differenceInCalendarMonths(date, start))) return null
  const dayOfMonth = date.getDate()
  switch (occurrence.monthly_mode) {
    case 'day_month':
      return occurrence.day_of_month === dayOfMonth
        ? DAY_OF_MONTH_BASE + dayOfMonth - 1
        : null
    case 'date_specific':
      return occurrence.date_specific_1 === dayOfMonth ||
        occurrence.date_specific_2 === dayOfMonth
        ? DAY_OF_MONTH_BASE + dayOfMonth - 1
        : null
    case 'day_position': {
      const rule = occurrence.day_position_rules?.[0]
      if (
        !rule ||
        SHIFT_REPEAT_WEEKDAYS.indexOf(rule.weekday) !== weekday ||
        Math.ceil(dayOfMonth / 7) !== rule.position
      )
        return null
      return DAY_POSITION_BASE + (rule.position - 1) * 7 + weekday
    }
    default:
      return null
  }
}

export function occurrenceSlots(
  occurrence: Occurrence | undefined,
  shiftId: string | undefined
): OccurrenceSlots {
  const slots = occurrence ? slotList(occurrence) : []
  return {
    pattern: shiftId
      ? slots.map((_, index) => ({
          position: index + 1,
          is_off: false,
          shift_id: shiftId,
        }))
      : [],
    slotKeys: slots.map((slot) => slot.key),
    labels: slots.map((slot) => slot.label),
  }
}
