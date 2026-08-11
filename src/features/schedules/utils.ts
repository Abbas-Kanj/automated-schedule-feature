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
    return sum + Math.max(differenceInMinutes(to, from), 0)
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

export function getScheduleTotalHours(schedule: Schedule): number {
  if (schedule.parent_type === 'regular') {
    if (schedule.type === 'rotate') {
      const activeHours = schedule.pattern.reduce((sum, p) => {
        if (p.is_off || !p.block_id) return sum
        const block = schedule.blocks.find((b) => b.id === p.block_id)
        return sum + (block ? calculateHours([block.time]) : 0)
      }, 0)
      return Math.round((activeHours / schedule.cycle_length.days) * 100) / 100
    }

    return schedule.shifts.reduce(
      (shiftSum, shift) =>
        shiftSum +
        shift.days.reduce((daySum, d) => daySum + calculateHours([d.time]), 0),
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

export function getScheduleSummary(schedule: Schedule): string {
  if (schedule.parent_type === 'regular') {
    if (schedule.type === 'rotate') {
      const cycleLabel = CYCLE_TYPE_OPTIONS.find(
        (o) => o.value === schedule.cycle_type
      )?.label
      return `${cycleLabel} · ${schedule.cycle_length.days}-day cycle`
    }

    const dayCount = schedule.shifts.reduce(
      (sum, shift) => sum + shift.days.length,
      0
    )
    return `${schedule.nb_of_shifts} shift${schedule.nb_of_shifts > 1 ? 's' : ''} · ${dayCount} day${dayCount === 1 ? '' : 's'}`
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
