import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
} from 'date-fns'
import { type OccurrenceRule, SHIFT_REPEAT_WEEKDAYS } from './data/schema'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
        'th')
  return `${n}${suffix}`
}

function wholeInterval(rule: Pick<OccurrenceRule, 'interval'>): number {
  return Number.isFinite(rule.interval) && rule.interval > 1
    ? Math.floor(rule.interval)
    : 1
}

// The working days a rule describes, as short labels ("Mon", "Day 15",
// "2nd Mon"). The interval ("every 2 weeks") is cadence, not a day, so it
// only shows up in the daily label.
export function occurrenceLabels(rule: OccurrenceRule | undefined): string[] {
  if (!rule) return []

  if (rule.frequency === 'daily') {
    const interval = wholeInterval(rule)
    return [interval === 1 ? 'Every day' : `Every ${interval} days`]
  }

  if (rule.frequency === 'weekly') {
    const chosen = new Set(rule.weekdays ?? [])
    return SHIFT_REPEAT_WEEKDAYS.flatMap((weekday, index) =>
      chosen.has(weekday) ? [WEEKDAY_LABELS[index]] : []
    )
  }

  switch (rule.monthly_mode) {
    case 'day_month':
    case 'date_specific': {
      const days =
        rule.monthly_mode === 'day_month'
          ? [rule.day_of_month]
          : [rule.date_specific_1, rule.date_specific_2]
      return [
        ...new Set(
          days.filter(
            (day): day is number =>
              Number.isInteger(day) &&
              (day as number) >= 1 &&
              (day as number) <= 28
          )
        ),
      ]
        .sort((a, b) => a - b)
        .map((day) => `Day ${day}`)
    }
    case 'day_position': {
      const position = rule.day_position_rules?.[0]
      const weekday = position
        ? SHIFT_REPEAT_WEEKDAYS.indexOf(position.weekday)
        : -1
      if (!position || weekday < 0 || !Number.isInteger(position.position))
        return []
      return [`${ordinal(position.position)} ${WEEKDAY_LABELS[weekday]}`]
    }
    default:
      return []
  }
}

// Whether a rule works on `date`. `start` anchors the interval ("every 2
// weeks" counts from the schedule's start week); start/end bounds are the
// caller's to apply.
export function occursOn(
  rule: OccurrenceRule,
  start: Date,
  date: Date
): boolean {
  const interval = wholeInterval(rule)
  const onCadence = (elapsed: number) =>
    ((elapsed % interval) + interval) % interval === 0
  // Monday = 0, matching `SHIFT_REPEAT_WEEKDAYS`.
  const weekday = (date.getDay() + 6) % 7

  if (rule.frequency === 'daily') {
    return onCadence(differenceInCalendarDays(date, start))
  }

  if (rule.frequency === 'weekly') {
    return (
      onCadence(differenceInCalendarWeeks(date, start, { weekStartsOn: 1 })) &&
      (rule.weekdays ?? []).includes(SHIFT_REPEAT_WEEKDAYS[weekday])
    )
  }

  if (!onCadence(differenceInCalendarMonths(date, start))) return false
  const dayOfMonth = date.getDate()
  switch (rule.monthly_mode) {
    case 'day_month':
      return rule.day_of_month === dayOfMonth
    case 'date_specific':
      return (
        rule.date_specific_1 === dayOfMonth ||
        rule.date_specific_2 === dayOfMonth
      )
    case 'day_position': {
      const position = rule.day_position_rules?.[0]
      return (
        !!position &&
        SHIFT_REPEAT_WEEKDAYS.indexOf(position.weekday) === weekday &&
        Math.ceil(dayOfMonth / 7) === position.position
      )
    }
    default:
      return false
  }
}
