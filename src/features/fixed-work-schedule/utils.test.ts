import { describe, expect, it } from 'vitest'
import { type Employee } from '@/features/employees/data/schema'
import { occurrenceKeyOn } from '@/features/schedules/occurrence-pattern'
import { type Shift } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'
import {
  type FixedSchedule,
  buildFixedRoster,
  buildFixedTimeline,
  makeWorkingKeyOn,
} from './utils'

// Local dates so weekday arithmetic isn't at the mercy of the runner's zone.
// 2026-08-31 is a Monday.
const day = (month: number, date: number) => new Date(2026, month - 1, date)

const office = {
  id: 'shift-office',
  name: 'Office',
  badge_color: 'blue',
} as unknown as Shift

const employees = [
  { id: 'e1', firstname: 'Ann', lastname: 'Lee' },
  { id: 'e2', firstname: 'Bo', lastname: 'Kim' },
] as unknown as Employee[]

const teams = [
  { id: 't1', name: 'Admin', employee_ids: ['e2'] },
] as unknown as Team[]

function fixed(overrides: Partial<FixedSchedule> = {}): FixedSchedule {
  return {
    id: 'fixed-1',
    name: 'Office',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-office'],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
    occurrence: {
      frequency: 'weekly',
      interval: 1,
      weekdays: ['mon', 'tue', 'wed'],
      exceptions: { public_holiday: false, sick_leave: false },
    },
    day_coverage: [
      { day: 1000, shift_id: 'shift-office', employee_ids: [], team_ids: ['t1'] },
      { day: 1002, shift_id: 'shift-office', employee_ids: [], team_ids: ['t1'] },
      { day: 1001, shift_id: 'shift-office', employee_ids: ['e1'], team_ids: [] },
    ],
    crew_placements: [],
    ...overrides,
  } as FixedSchedule
}

describe('occurrenceKeyOn', () => {
  it('counts a weekly interval from the week the schedule starts in', () => {
    const occurrence = {
      frequency: 'weekly' as const,
      interval: 2,
      weekdays: ['mon' as const, 'wed' as const],
      exceptions: { public_holiday: false, sick_leave: false },
    }
    const start = day(9, 2) // Wednesday
    expect(occurrenceKeyOn(occurrence, start, day(9, 2))).toBe(1002)
    expect(occurrenceKeyOn(occurrence, start, day(9, 7))).toBeNull()
    expect(occurrenceKeyOn(occurrence, start, day(9, 9))).toBeNull()
    expect(occurrenceKeyOn(occurrence, start, day(9, 14))).toBe(1000)
  })

  it('matches a monthly day position to the right week of the month', () => {
    const occurrence = {
      frequency: 'monthly' as const,
      interval: 1,
      monthly_mode: 'day_position' as const,
      day_position_rules: [{ position: 2, weekday: 'mon' as const }],
      exceptions: { public_holiday: false, sick_leave: false },
    }
    const start = day(9, 1)
    expect(occurrenceKeyOn(occurrence, start, day(9, 7))).toBeNull()
    expect(occurrenceKeyOn(occurrence, start, day(9, 14))).toBe(3007)
  })
})

describe('makeWorkingKeyOn', () => {
  it('is off before the start and past an end date', () => {
    const keyOn = makeWorkingKeyOn(
      fixed({
        start_date: '2026-09-02',
        end_settings: { end_type: 'on_date', end_date: '2026-09-08' },
      })
    )
    expect(keyOn(day(8, 31))).toBeNull()
    expect(keyOn(day(9, 2))).toBe(1002)
    expect(keyOn(day(9, 7))).toBe(1000)
    expect(keyOn(day(9, 14))).toBeNull()
  })

  it('stops after the N-th working day', () => {
    const keyOn = makeWorkingKeyOn(
      fixed({
        end_settings: { end_type: 'after_occurrences', end_occurrences: 3 },
      })
    )
    expect(keyOn(day(9, 2))).toBe(1002)
    expect(keyOn(day(9, 7))).toBeNull()
  })
})

describe('buildFixedTimeline', () => {
  it('draws each crew on the weekdays it is stored under', () => {
    const timeline = buildFixedTimeline(
      fixed(),
      [office],
      employees,
      teams,
      day(9, 16),
      'week',
      day(9, 16)
    )
    expect(timeline.rows.map((row) => row.label)).toEqual(['Admin', 'Ann Lee'])
    const [admin, ann] = timeline.rows
    // Mon..Sun
    expect(admin.cells.map((cell) => cell.isOff)).toEqual([
      false, true, false, true, true, true, true,
    ])
    expect(ann.cells.map((cell) => cell.isOff)).toEqual([
      true, false, true, true, true, true, true,
    ])
    expect(ann.startDate).toEqual(day(9, 1))
    expect(timeline.legend.map((p) => p.label)).toEqual(['Office', 'Off'])
  })
})

describe('buildFixedRoster', () => {
  it('lists each person’s working days and the shift on the given date', () => {
    const rows = buildFixedRoster(
      fixed(),
      [office],
      employees,
      teams,
      day(9, 14)
    )
    const byName = Object.fromEntries(rows.map((row) => [row.fullName, row]))

    expect(byName['Bo Kim'].crewLabel).toBe('Admin')
    expect(byName['Bo Kim'].shifts[0].days).toEqual(['Mon', 'Wed'])
    expect(byName['Bo Kim'].onDate.label).toBe('Office')

    expect(byName['Ann Lee'].shifts[0].days).toEqual(['Tue'])
    expect(byName['Ann Lee'].onDate.isOff).toBe(true)
  })
})
