import { describe, expect, it } from 'vitest'
import { type Employee } from '@/features/employees/data/schema'
import { type Shift } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'
import {
  type FixedSchedule,
  buildFixedRoster,
  buildFixedTimeline,
  getFixedDefaultSpan,
  makeWorkingShiftsOn,
} from './utils'

// Local dates so weekday arithmetic isn't at the mercy of the runner's zone.
// 2026-08-31 is a Monday.
const day = (month: number, date: number) => new Date(2026, month - 1, date)

function shift(id: string, name: string, from: string): Shift {
  return {
    id,
    name,
    badge_color: 'blue',
    days: [
      {
        day: 'mon',
        enabled: true,
        times: [{ from_time: from, to_time: '23:00' }],
      },
    ],
  } as unknown as Shift
}

const office = shift('shift-office', 'Office', '09:00')
const night = shift('shift-night', 'Night', '22:00')

const employees = [
  { id: 'e1', firstname: 'Ann', lastname: 'Lee' },
  { id: 'e2', firstname: 'Bo', lastname: 'Kim' },
] as unknown as Employee[]

const teams = [
  { id: 't1', name: 'Admin', employee_ids: ['e2'] },
] as unknown as Team[]

// Office Mon–Wed every week; Night on Saturdays every other week.
function fixed(overrides: Partial<FixedSchedule> = {}): FixedSchedule {
  return {
    id: 'fixed-1',
    name: 'Office',
    description: '',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-office', 'shift-night'],
    temporary_schedule: false,
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
    shift_occurrences: [
      {
        shift_id: 'shift-office',
        frequency: 'weekly',
        interval: 1,
        weekdays: ['mon', 'tue', 'wed'],
      },
      {
        shift_id: 'shift-night',
        frequency: 'weekly',
        interval: 2,
        weekdays: ['sat'],
      },
    ],
    occurrence_exceptions: { public_holiday: false, sick_leave: false },
    crew_kind: 'team',
    shift_assignments: [
      { shift_id: 'shift-office', employee_ids: ['e1'], team_ids: ['t1'] },
      { shift_id: 'shift-night', employee_ids: [], team_ids: ['t1'] },
    ],
    ...overrides,
  } as FixedSchedule
}

describe('makeWorkingShiftsOn', () => {
  it('runs each shift on its own rule', () => {
    const shiftsOn = makeWorkingShiftsOn(fixed(), [office, night])
    expect(shiftsOn(day(8, 31))).toEqual(['shift-office'])
    expect(shiftsOn(day(9, 3))).toEqual([])
    expect(shiftsOn(day(9, 5))).toEqual(['shift-night'])
    expect(shiftsOn(day(9, 12))).toEqual([])
    expect(shiftsOn(day(9, 19))).toEqual(['shift-night'])
  })

  it('is off before the start and past an end date', () => {
    const shiftsOn = makeWorkingShiftsOn(
      fixed({
        start_date: '2026-09-02',
        end_settings: { end_type: 'on_date', end_date: '2026-09-08' },
      }),
      [office, night]
    )
    expect(shiftsOn(day(8, 31))).toEqual([])
    expect(shiftsOn(day(9, 2))).toEqual(['shift-office'])
    expect(shiftsOn(day(9, 7))).toEqual(['shift-office'])
    expect(shiftsOn(day(9, 14))).toEqual([])
  })

  it('stops after the N-th day any shift works', () => {
    const shiftsOn = makeWorkingShiftsOn(
      fixed({
        end_settings: { end_type: 'after_occurrences', end_occurrences: 4 },
      }),
      [office, night]
    )
    // Mon, Tue, Wed, then Sat night is the 4th.
    expect(shiftsOn(day(9, 5))).toEqual(['shift-night'])
    expect(shiftsOn(day(9, 7))).toEqual([])
  })
})

describe('buildFixedTimeline', () => {
  it('draws each crew on the days its shifts run', () => {
    const timeline = buildFixedTimeline(
      fixed(),
      [office, night],
      employees,
      teams,
      day(9, 1),
      'week',
      day(9, 1)
    )
    expect(timeline.rows.map((row) => row.label)).toEqual(['Admin', 'Ann Lee'])
    const [admin, ann] = timeline.rows
    // Mon..Sun, week of Aug 31 — the night's first Saturday.
    expect(admin.cells.map((cell) => cell.label)).toEqual([
      'Office',
      'Office',
      'Office',
      'Off',
      'Off',
      'Night',
      'Off',
    ])
    expect(ann.cells.map((cell) => cell.label)).toEqual([
      'Office',
      'Office',
      'Office',
      'Off',
      'Off',
      'Off',
      'Off',
    ])
    expect(ann.startDate).toEqual(day(8, 31))
    expect(timeline.legend.map((p) => p.label)).toEqual([
      'Office',
      'Night',
      'Off',
    ])
  })
})

describe('buildFixedRoster', () => {
  it('lists each person’s shifts with their days, and the shift on the date', () => {
    const rows = buildFixedRoster(
      fixed(),
      [office, night],
      employees,
      teams,
      day(9, 5)
    )
    const byName = Object.fromEntries(rows.map((row) => [row.fullName, row]))

    expect(byName['Bo Kim'].crewLabel).toBe('Admin')
    expect(
      byName['Bo Kim'].shifts.map((s) => [s.position.label, s.days])
    ).toEqual([
      ['Office', ['Mon', 'Tue', 'Wed']],
      ['Night', ['Sat']],
    ])
    expect(byName['Bo Kim'].onDate.label).toBe('Night')

    expect(byName['Ann Lee'].shifts.map((s) => s.position.label)).toEqual([
      'Office',
    ])
    expect(byName['Ann Lee'].onDate.isOff).toBe(true)
  })
})

describe('getFixedDefaultSpan', () => {
  it('opens on a month when any shift repeats monthly', () => {
    expect(getFixedDefaultSpan(fixed())).toBe('week')
    const [first, second] = fixed().shift_occurrences
    expect(
      getFixedDefaultSpan(
        fixed({
          shift_occurrences: [
            first,
            {
              ...second,
              frequency: 'monthly',
              monthly_mode: 'day_month',
              day_of_month: 3,
            },
          ],
        })
      )
    ).toBe('month')
  })
})
