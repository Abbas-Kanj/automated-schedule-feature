import { parse } from 'date-fns'
import { describe, expect, it } from 'vitest'
import employeeData from '@/features/employees/data/data.json'
import { type Employee } from '@/features/employees/data/schema'
import { defaultSchedules } from '@/features/schedules/data/schedules'
import { defaultShifts } from '@/features/shifts/data/shifts'
import { defaultTeams } from '@/features/teams/data/teams'
import { buildRotationTimeline } from './timeline'
import { type RotateSchedule, getAdvanceType, isRotateSchedule } from './utils'

const employees = employeeData as Employee[]

function rotateSchedule(name: string): RotateSchedule {
  const schedule = defaultSchedules.find((s) => s.name === name)
  if (!schedule || !isRotateSchedule(schedule)) {
    throw new Error('No seeded rotate schedule named ' + name)
  }
  return schedule
}

const panama = rotateSchedule('Plant Coverage (2-2-3)')
const alternation = rotateSchedule('Desk Alternation')
const dupont = rotateSchedule('Security — 24/7 Guard (DuPont)')

function build(
  schedule: RotateSchedule,
  date: string,
  periodType: 'daily' | 'weekly',
  span: 'week' | 'month'
) {
  return buildRotationTimeline(
    schedule,
    defaultShifts,
    employees,
    defaultTeams,
    parse(date, 'yyyy-MM-dd', new Date()),
    periodType,
    span,
    parse('2000-01-01', 'yyyy-MM-dd', new Date())
  )
}

describe('buildRotationTimeline', () => {
  it('covers the whole calendar month, blocked in sevens with a short tail', () => {
    const timeline = build(panama, '2026-09-15', 'daily', 'month')

    expect(timeline.days).toHaveLength(30)
    expect(timeline.days[0].date.getDate()).toBe(1)
    expect(timeline.days[29].date.getDate()).toBe(30)
    expect(timeline.blocks.map((b) => b.days.length)).toEqual([7, 7, 7, 7, 2])
    expect(timeline.blocks.map((b) => b.label)).toEqual([
      'Days 1\u20137',
      'Days 8\u201314',
      'Days 15\u201321',
      'Days 22\u201328',
      'Days 29\u201330',
    ])
  })

  it('covers Monday to Sunday of the viewed week', () => {
    const timeline = build(panama, '2026-09-17', 'daily', 'week')

    expect(timeline.days).toHaveLength(7)
    // 2026-09-17 is a Thursday; the week it belongs to starts Monday the 14th.
    expect(timeline.days[0].date.getDay()).toBe(1)
    expect(timeline.days[0].date.getDate()).toBe(14)
    expect(timeline.blocks).toHaveLength(1)
  })

  it('gives every crew one cell per visible day, index-aligned', () => {
    const timeline = build(panama, '2026-09-15', 'daily', 'month')

    expect(timeline.rows.length).toBeGreaterThan(0)
    timeline.rows.forEach((row) => {
      expect(row.cells).toHaveLength(timeline.days.length)
      expect(row.daysOn).toBe(row.cells.filter((c) => !c.isOff).length)
    })
  })

  it('steps the cycle once per day when the rotation advances daily', () => {
    const timeline = build(panama, '2026-09-15', 'daily', 'month')
    const cycleDays = timeline.days.slice(0, 5).map((d) => d.cycleDay)

    // Consecutive calendar days land on consecutive cycle positions.
    cycleDays.slice(1).forEach((day, i) => {
      expect(day).toBe((cycleDays[i] + 1) % timeline.cycleLength)
    })
  })

  // The two readings of a pattern differ by a factor of seven (see
  // `RotationPeriodType`), and the grid has to show that difference rather
  // than quietly drawing days either way: a week-per-card rotation is seven
  // identical dots, not seven different ones.
  it('holds one cycle position for a whole week when the rotation advances weekly', () => {
    const timeline = build(alternation, '2026-09-14', 'weekly', 'week')

    expect(new Set(timeline.days.map((d) => d.cycleDay)).size).toBe(1)
    timeline.rows.forEach((row) => {
      expect(new Set(row.cells.map((c) => c.label)).size).toBe(1)
    })
  })

  it('lists every selected shift in the legend, plus an off entry', () => {
    const timeline = build(panama, '2026-09-15', 'daily', 'month')
    const names = timeline.legend.map((p) => p.label)

    panama.shift_ids.forEach((id) => {
      const shift = defaultShifts.find((s) => s.id === id)!
      expect(names).toContain(shift.name)
    })
    expect(names[names.length - 1]).toBe('Off')
    expect(timeline.legend[timeline.legend.length - 1].isOff).toBe(true)
  })

  // Rows are crews, not people — a four-person team is one row, which is the
  // whole reason this view exists next to the employee table.
  it('renders one row per crew rather than one per employee', () => {
    const timeline = build(dupont, '2026-09-15', 'daily', 'month')
    const keys = timeline.rows.map((r) => r.key)

    expect(new Set(keys).size).toBe(keys.length)
    expect(timeline.rows.some((row) => row.headcount > 1)).toBe(true)
  })

  // The screen no longer asks how fast a rotation advances — it reads it off
  // the schedule. Every seeded roster is a day-card pattern, so every one of
  // them has to come back `daily`; a seed that came back `weekly` would render
  // as a cycle seven times longer than it is.
  it('reads the advance rate off the schedule rather than asking', () => {
    const rotates = defaultSchedules.filter(isRotateSchedule)

    expect(rotates.length).toBeGreaterThan(0)
    rotates.forEach((schedule) => {
      expect([schedule.name, getAdvanceType(schedule)]).toEqual([
        schedule.name,
        'daily',
      ])
    })
  })
})
