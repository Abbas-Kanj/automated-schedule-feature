import {
  addDays,
  differenceInMinutes,
  format,
  getDaysInMonth,
  parse,
  startOfMonth,
} from 'date-fns'
import { CYCLE_TYPE_OPTIONS } from './data/data'
import { type DayOfWeek, type Schedule, type TimeRange } from './data/schema'
import { type Shift } from '@/features/shifts/data/schema'

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
