import { describe, expect, it } from 'vitest'
import { type Employee } from '@/features/employees/data/schema'
import { type Shift } from '@/features/shifts/data/schema'
import { buildDefaultDays } from '@/features/shifts/utils'
import { type Team } from '@/features/teams/data/schema'
import {
  type RotateSchedule,
  buildRotation,
  getAssignedIndex,
  getRotationPositions,
  getRotationRoster,
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

// These three keep their own "Assign to" picks (Alice on Morning, Bob on
// Afternoon, the Night Crew team on Night) purely so the tests below can
// show the roster no longer reads them.
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
  // The whole roster, stated on the schedule rather than inferred from the
  // shifts: one crew per position, including the day off (which has no
  // shift to carry a pick in the first place).
  pattern: [
    {
      position: 1,
      shift_id: 'shift-morning',
      is_off: false,
      employee_ids: ['e-alice'],
    },
    {
      position: 2,
      shift_id: 'shift-afternoon',
      is_off: false,
      employee_ids: ['e-bob'],
    },
    {
      position: 3,
      shift_id: 'shift-night',
      is_off: false,
      team_ids: ['team-night'],
    },
    { position: 4, is_off: true, employee_ids: ['e-dana'] },
  ],
  shift_repeat: [],
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
  it('derives employees from the pattern (incl. teams), offset by position', () => {
    const positions = getRotationPositions(schedule, shifts)
    const roster = getRotationRoster(positions, employees, teams)
    expect(roster.map((r) => [r.employeeId, r.offset])).toEqual([
      ['e-alice', 0],
      ['e-bob', 1],
      ['e-charlie', 2], // resolved from the team on the Night position
      ['e-dana', 3], // on the off position
    ])
  })

  it("ignores crew assigned to a position's shift", () => {
    // Same shifts, all still naming Alice/Bob/the Night Crew in their own
    // "Assign to" tab — but nothing on the pattern, so nobody rotates.
    const positions = getRotationPositions(
      {
        ...schedule,
        pattern: schedule.pattern.map(({ position, shift_id, is_off }) => ({
          position,
          shift_id,
          is_off,
        })),
      },
      shifts
    )
    expect(getRotationRoster(positions, employees, teams)).toEqual([])
  })

  it('ignores a direct pick that no longer matches an employee', () => {
    const positions = getRotationPositions(
      {
        ...schedule,
        pattern: [
          ...schedule.pattern.slice(0, 3),
          { position: 4, is_off: true, employee_ids: ['e-ghost'] },
        ],
      },
      shifts
    )
    const roster = getRotationRoster(positions, employees, teams)
    expect(roster.map((r) => r.employeeId)).toEqual([
      'e-alice',
      'e-bob',
      'e-charlie',
    ])
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
