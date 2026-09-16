import { addDays } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { type Employee } from '@/features/employees/data/schema'
import { type Shift } from '@/features/shifts/data/schema'
import { buildDefaultDays } from '@/features/shifts/utils'
import { type Team } from '@/features/teams/data/schema'
import {
  type RotateSchedule,
  buildRotation,
  cycleDayDates,
  getAssignedIndex,
  getPeriodEnd,
  getPeriodIndex,
  getRangeLabel,
  getPeriodStart,
  getRotationPositions,
  getRotationRoster,
  shiftPeriod,
} from './utils'

function makeShift(
  overrides: Partial<Shift> & Pick<Shift, 'id' | 'name'>
): Shift {
  return {
    short_code: overrides.name.slice(0, 4).toUpperCase(),
    badge_color: 'blue',
    icon: 'clock',
    shift_type: 'fixed',
    category: 'regular',
    custom_category: undefined,
    timezone_mode: 'local',
    timezone: undefined,
    hours_mode: 'same',
    days: buildDefaultDays(
      { from_time: '09:00', to_time: '17:00', overnight: false },
      true
    ),
    break_enabled: false,
    breaks: [],
    description: undefined,
    is_active: true,
    policy_ids: [],
    status: 'confirmed',
    time_slot_type: 'regular',
    repeat_enabled: false,
    repeat: {},
    assign_to_enabled: true,
    work_type_group: undefined,
    service_resource: undefined,
    service_territory: undefined,
    employee_ids: [],
    team_ids: [],
    ...overrides,
  }
}

function makeEmployee(id: string, firstname: string): Employee {
  return {
    id,
    firstname,
    middlename: 'M',
    lastname: 'Test',
    dob: '1990-01-01',
    sex: { value: 'male', label: 'Male' },
    address: 'Somewhere',
    email: `${firstname.toLowerCase()}@example.com`,
    phonenumber: '+100',
    position: { value: 'staff', label: 'Staff' },
    organization_unit: { value: 'ops', label: 'Operations' },
  }
}

const morning = makeShift({
  id: 'shift-morning',
  name: 'Morning',
  employee_ids: ['e-alice'],
})
const afternoon = makeShift({
  id: 'shift-afternoon',
  name: 'Afternoon',
  employee_ids: ['e-bob'],
})
const night = makeShift({
  id: 'shift-night',
  name: 'Night',
  team_ids: ['team-night'],
})

// These three keep their own "Assign to" picks so the tests below can show
// the roster doesn't read them.
const shifts = [morning, afternoon, night]
const employees = [
  makeEmployee('e-alice', 'Alice'),
  makeEmployee('e-bob', 'Bob'),
  makeEmployee('e-charlie', 'Charlie'),
  makeEmployee('e-dana', 'Dana'),
]
const teams: Team[] = [
  { id: 'team-night', name: 'Night Crew', employee_ids: ['e-charlie'] },
]

// Morning -> Afternoon -> Night -> Off, starting on a Monday.
const schedule: RotateSchedule = {
  id: 'sched-rotate',
  name: 'Floor Rotation',
  description: '',
  parent_type: 'regular',
  type: 'rotate',
  shift_ids: ['shift-morning', 'shift-afternoon', 'shift-night'],
  temporary_schedule: false,
  cycle_type: 'pattern_shifts',
  cycle_length: { unit: 'custom_days', days: 4 },
  pattern: [
    { position: 1, shift_id: 'shift-morning', is_off: false },
    { position: 2, shift_id: 'shift-afternoon', is_off: false },
    { position: 3, shift_id: 'shift-night', is_off: false },
    { position: 4, is_off: true },
  ],
  shift_repeat: [],
  // Four crews staggered one card apart, so every shift is covered every day
  // and exactly one crew rests. Charlie arrives through a team, not by name.
  crew_placements: [],
  day_coverage: [
    {
      day: 0,
      shift_id: 'shift-morning',
      employee_ids: ['e-alice'],
      team_ids: [],
    },
    {
      day: 0,
      shift_id: 'shift-afternoon',
      employee_ids: ['e-bob'],
      team_ids: [],
    },
    {
      day: 0,
      shift_id: 'shift-night',
      employee_ids: [],
      team_ids: ['team-night'],
    },
    {
      day: 1,
      shift_id: 'shift-morning',
      employee_ids: ['e-dana'],
      team_ids: [],
    },
    {
      day: 1,
      shift_id: 'shift-afternoon',
      employee_ids: ['e-alice'],
      team_ids: [],
    },
    { day: 1, shift_id: 'shift-night', employee_ids: ['e-bob'], team_ids: [] },
    {
      day: 2,
      shift_id: 'shift-morning',
      employee_ids: [],
      team_ids: ['team-night'],
    },
    {
      day: 2,
      shift_id: 'shift-afternoon',
      employee_ids: ['e-dana'],
      team_ids: [],
    },
    {
      day: 2,
      shift_id: 'shift-night',
      employee_ids: ['e-alice'],
      team_ids: [],
    },
    {
      day: 3,
      shift_id: 'shift-morning',
      employee_ids: ['e-bob'],
      team_ids: [],
    },
    {
      day: 3,
      shift_id: 'shift-afternoon',
      employee_ids: [],
      team_ids: ['team-night'],
    },
    { day: 3, shift_id: 'shift-night', employee_ids: ['e-dana'], team_ids: [] },
  ],
  start_date: '2026-08-17',
  end_settings: { end_type: 'never' },
}

describe('getRotationPositions', () => {
  it('resolves the pattern into letters, labels and off days', () => {
    const positions = getRotationPositions(schedule, shifts)
    expect(positions.map((p) => p.letter)).toEqual(['M', 'A', 'N', 'O'])
    expect(positions.map((p) => p.label)).toEqual([
      'Morning',
      'Afternoon',
      'Night',
      'Off',
    ])
    expect(positions[3].isOff).toBe(true)
  })

  it('treats a position pointing at a missing shift as off', () => {
    const positions = getRotationPositions(schedule, [morning, afternoon])
    expect(positions[2].isOff).toBe(true)
  })
})

describe('getRotationRoster', () => {
  it('derives every employee from day_coverage, teams resolved to members', () => {
    const roster = getRotationRoster(schedule, employees, teams)
    expect(roster.map((r) => [r.employeeId, r.offset])).toEqual([
      ['e-alice', 0],
      ['e-bob', 0],
      ['e-charlie', 0], // resolved from the team named on day 0's Night cell
      ['e-dana', 1],
    ])
  })

  it('gives each employee the shift the matrix puts them on, per cycle day', () => {
    const roster = getRotationRoster(schedule, employees, teams)
    const alice = roster.find((r) => r.employeeId === 'e-alice')!
    expect([...alice.byDay.entries()]).toEqual([
      [0, 'shift-morning'],
      [1, 'shift-afternoon'],
      [2, 'shift-night'],
    ])
  })

  it("ignores crew assigned to a shift's own Assign-to tab", () => {
    expect(
      getRotationRoster({ ...schedule, day_coverage: [] }, employees, teams)
    ).toEqual([])
  })

  it('ignores a pick that no longer matches an employee', () => {
    const roster = getRotationRoster(
      {
        ...schedule,
        crew_placements: [],
        day_coverage: [
          ...schedule.day_coverage,
          {
            day: 3,
            shift_id: 'shift-morning',
            employee_ids: ['e-ghost'],
            team_ids: [],
          },
        ],
      },
      employees,
      teams
    )
    expect(roster.map((r) => r.employeeId)).not.toContain('e-ghost')
  })
})

describe('getAssignedIndex', () => {
  it('advances by the period index and wraps within the cycle', () => {
    expect(getAssignedIndex(0, 0, 4)).toBe(0)
    expect(getAssignedIndex(1, 0, 4)).toBe(1)
    expect(getAssignedIndex(0, 1, 4)).toBe(1)
    expect(getAssignedIndex(2, 3, 4)).toBe(1) // wraps
    expect(getAssignedIndex(0, -1, 4)).toBe(3) // negative wraps too
  })
})

describe('buildRotation', () => {
  it('staggers each employee at period 0 and starts the sequence at their shift', () => {
    const rotation = buildRotation(
      schedule,
      shifts,
      employees,
      teams,
      new Date(2026, 7, 17), // start-date week -> period 0
      'weekly'
    )
    expect(rotation.periodIndex).toBe(0)
    const byName = Object.fromEntries(rotation.rows.map((r) => [r.fullName, r]))
    expect(byName['Alice M Test'].assigned.label).toBe('Morning')
    expect(byName['Bob M Test'].assigned.label).toBe('Afternoon')
    expect(byName['Charlie M Test'].assigned.label).toBe('Night')
    expect(byName['Dana M Test'].assigned.label).toBe('Off')
    // Sequence starts at the employee's current position (Alice: M A N O).
    expect(byName['Alice M Test'].sequence.map((p) => p.letter)).toEqual([
      'M',
      'A',
      'N',
      'O',
    ])
    expect(byName['Bob M Test'].sequence.map((p) => p.letter)).toEqual([
      'A',
      'N',
      'O',
      'M',
    ])
  })

  it('advances every employee one position the next week', () => {
    const rotation = buildRotation(
      schedule,
      shifts,
      employees,
      teams,
      new Date(2026, 7, 24), // one week after the start date
      'weekly'
    )
    expect(rotation.periodIndex).toBe(1)
    const byName = Object.fromEntries(rotation.rows.map((r) => [r.fullName, r]))
    expect(byName['Alice M Test'].assigned.label).toBe('Afternoon')
    expect(byName['Bob M Test'].assigned.label).toBe('Night')
    expect(byName['Charlie M Test'].assigned.label).toBe('Off')
    expect(byName['Dana M Test'].assigned.label).toBe('Morning')
  })

  it('advances one position per month in monthly mode', () => {
    const rotation = buildRotation(
      schedule,
      shifts,
      employees,
      teams,
      new Date(2026, 9, 5), // two months after August
      'monthly'
    )
    expect(rotation.periodIndex).toBe(2)
    const alice = rotation.rows.find((r) => r.fullName === 'Alice M Test')!
    expect(alice.assigned.label).toBe('Night') // (0 + 2) % 4
  })
})

// Makes a day-based pattern (2-2-3, 4-on-4-off, DuPont) mean what it says —
// read weekly the same cards would describe a cycle seven times longer.
describe('daily period type', () => {
  it('advances exactly one position per calendar day', () => {
    const start = new Date(2026, 7, 17)
    const labels = [0, 1, 2, 3, 4].map((dayOffset) => {
      const rotation = buildRotation(
        schedule,
        shifts,
        employees,
        teams,
        addDays(start, dayOffset),
        'daily'
      )
      expect(rotation.periodIndex).toBe(dayOffset)
      return rotation.rows.find((r) => r.fullName === 'Alice M Test')!.assigned
        .label
    })

    expect(labels).toEqual(['Morning', 'Afternoon', 'Night', 'Off', 'Morning'])
  })

  it('composes into the plain modulo the pattern describes', () => {
    // `(daysSinceStart + offset) mod cycleLength`, spelled out so a change to
    // either side breaks this deliberately.
    const cycleLength = 4
    for (const days of [-9, -1, 0, 1, 13]) {
      for (const offset of [0, 1, 2, 3]) {
        const viewDate = addDays(new Date(2026, 7, 17), days)
        const periodIndex = getPeriodIndex(schedule, viewDate, 'daily')
        expect(periodIndex).toBe(days)
        expect(getAssignedIndex(offset, periodIndex, cycleLength)).toBe(
          (((days + offset) % cycleLength) + cycleLength) % cycleLength
        )
      }
    }
  })

  it('labels a single day rather than a range', () => {
    const rotation = buildRotation(
      schedule,
      shifts,
      employees,
      teams,
      new Date(2026, 7, 19),
      'daily'
    )
    expect(rotation.rangeLabel).toBe('Wed, Aug 19, 2026')
  })
})

// A period's start, end, and step to the next one all have to describe the
// same unit, or paging lands somewhere the rotation math doesn't expect.
describe('period boundaries', () => {
  // A Wednesday, deliberately mid-week and mid-month.
  const viewDate = new Date(2026, 0, 14, 15, 30)

  it('starts a daily period at midnight and ends it just before the next', () => {
    expect(getPeriodStart(viewDate, 'daily')).toEqual(new Date(2026, 0, 14))
    expect(getPeriodEnd(viewDate, 'daily').getDate()).toBe(14)
    expect(getPeriodEnd(viewDate, 'daily').getHours()).toBe(23)
  })

  // Monday-first, matching the weekday chips used everywhere else.
  it('starts a weekly period on the Monday', () => {
    const start = getPeriodStart(viewDate, 'weekly')
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(12)
    expect(getPeriodEnd(viewDate, 'weekly').getDay()).toBe(0)
  })

  it('starts a monthly period on the first', () => {
    expect(getPeriodStart(viewDate, 'monthly').getDate()).toBe(1)
    expect(getPeriodEnd(viewDate, 'monthly').getDate()).toBe(31)
  })

  it('steps by the same unit it measures, in both directions', () => {
    expect(shiftPeriod(viewDate, 'daily', 1).getDate()).toBe(15)
    expect(shiftPeriod(viewDate, 'daily', -1).getDate()).toBe(13)
    expect(shiftPeriod(viewDate, 'weekly', 1).getDate()).toBe(21)
    expect(shiftPeriod(viewDate, 'monthly', 1).getMonth()).toBe(1)
    expect(shiftPeriod(viewDate, 'monthly', -1).getMonth()).toBe(11)
  })

  it('advances the period index by exactly one per step', () => {
    const schedule = {
      start_date: '2026-01-05',
    } as RotateSchedule

    ;(['daily', 'weekly', 'monthly'] as const).forEach((periodType) => {
      const here = getPeriodIndex(schedule, viewDate, periodType)
      const next = getPeriodIndex(
        schedule,
        shiftPeriod(viewDate, periodType, 1),
        periodType
      )
      expect(next - here, periodType).toBe(1)
    })
  })

  it('goes negative before the schedule starts', () => {
    const schedule = { start_date: '2026-01-05' } as RotateSchedule
    expect(getPeriodIndex(schedule, new Date(2026, 0, 1), 'daily')).toBe(-4)
  })
})

describe('getRangeLabel', () => {
  it('names a single day in daily mode', () => {
    const day = new Date(2026, 0, 14)
    expect(getRangeLabel(day, day, 'daily')).toBe('Wed, Jan 14, 2026')
  })

  it('names the month in monthly mode', () => {
    expect(
      getRangeLabel(new Date(2026, 0, 1), new Date(2026, 0, 31), 'monthly')
    ).toBe('January 2026')
  })

  it('does not repeat the month for a week inside one month', () => {
    expect(
      getRangeLabel(new Date(2026, 0, 12), new Date(2026, 0, 18), 'weekly')
    ).toBe('Jan 12 – 18, 2026')
  })

  it('names both months for a week that straddles them', () => {
    expect(
      getRangeLabel(new Date(2026, 0, 26), new Date(2026, 1, 1), 'weekly')
    ).toBe('Jan 26 – Feb 1, 2026')
  })
})

describe('cycleDayDates', () => {
  it('gives a card-a-day cycle consecutive dates from the start', () => {
    const dates = cycleDayDates(
      { ...schedule, start_date: '2026-09-02' },
      'daily'
    )
    expect(dates).toEqual([
      new Date(2026, 8, 2),
      new Date(2026, 8, 3),
      new Date(2026, 8, 4),
      new Date(2026, 8, 5),
    ])
  })

  // A weekly-advancing cycle starting mid-week: period 0 is the start's own
  // week, so card 0 falls on the start date and card 1 on the next Monday.
  it('steps a week-a-card cycle by Monday-first weeks', () => {
    const dates = cycleDayDates(
      { ...schedule, start_date: '2026-09-02' },
      'weekly'
    )
    expect(dates).toEqual([
      new Date(2026, 8, 2),
      new Date(2026, 8, 7),
      new Date(2026, 8, 14),
      new Date(2026, 8, 21),
    ])
  })

  it('leaves every day undated without a usable start', () => {
    expect(cycleDayDates({ ...schedule, start_date: '' }, 'daily')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})
