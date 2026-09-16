import { describe, expect, it } from 'vitest'
import { scheduleSchema } from './data/schema'
import {
  assignedCrewIds,
  crewsOnMultipleShifts,
  migrateLegacyFixedSchedule,
  shiftCrewIds,
  withShiftCrewIds,
} from './fixed-schedule'

const assignments = [
  { shift_id: 'morning', employee_ids: ['e1'], team_ids: ['t1', 't2'] },
  { shift_id: 'night', employee_ids: ['e1'], team_ids: ['t1'] },
  { shift_id: 'evening', employee_ids: [], team_ids: ['t1'] },
]

describe('crewsOnMultipleShifts', () => {
  it('names each crew picked on more than one shift, with its shifts', () => {
    const teams = crewsOnMultipleShifts(assignments, 'team')
    expect([...teams]).toEqual([['t1', ['morning', 'night', 'evening']]])
    expect([...crewsOnMultipleShifts(assignments, 'employee')]).toEqual([
      ['e1', ['morning', 'night']],
    ])
  })

  it('finds nothing when every crew is on one shift', () => {
    expect(crewsOnMultipleShifts([assignments[0]], 'team').size).toBe(0)
    expect(crewsOnMultipleShifts(undefined, 'team').size).toBe(0)
  })
})

describe('shift crew edits', () => {
  it('reads and replaces one shift’s crews of a kind', () => {
    expect(shiftCrewIds(assignments, 'morning', 'team')).toEqual(['t1', 't2'])
    const next = withShiftCrewIds(assignments, 'morning', 'team', ['t3'])
    expect(shiftCrewIds(next, 'morning', 'team')).toEqual(['t3'])
    expect(shiftCrewIds(next, 'morning', 'employee')).toEqual(['e1'])
  })

  it('adds a row for a new shift and drops a row emptied of everyone', () => {
    const added = withShiftCrewIds([], 'night', 'employee', ['e2'])
    expect(added).toEqual([
      { shift_id: 'night', employee_ids: ['e2'], team_ids: [] },
    ])
    expect(withShiftCrewIds(added, 'night', 'employee', [])).toEqual([])
  })

  it('lists each crew once across shifts', () => {
    expect(assignedCrewIds(assignments, 'team')).toEqual(['t1', 't2'])
  })
})

describe('migrateLegacyFixedSchedule', () => {
  const legacy = {
    id: 'fixed-old',
    name: 'Old office',
    description: '',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['morning', 'night'],
    temporary_schedule: false,
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
    occurrence: {
      frequency: 'weekly',
      interval: 1,
      weekdays: ['mon', 'tue'],
      exceptions: { public_holiday: true, sick_leave: false },
    },
    crew_kind: 'team',
    crew_ids: ['t1'],
    day_coverage: [
      { day: 1000, shift_id: 'morning', employee_ids: [], team_ids: ['t1'] },
      { day: 1001, shift_id: 'morning', employee_ids: [], team_ids: ['t1'] },
      { day: 1000, shift_id: 'night', employee_ids: ['e1'], team_ids: [] },
    ],
    crew_placements: [],
  }

  it('gives every shift the old rule and groups the roster by shift', () => {
    const migrated = migrateLegacyFixedSchedule(legacy) as Record<
      string,
      unknown
    >
    expect(migrated.shift_occurrences).toEqual([
      {
        shift_id: 'morning',
        frequency: 'weekly',
        interval: 1,
        weekdays: ['mon', 'tue'],
      },
      {
        shift_id: 'night',
        frequency: 'weekly',
        interval: 1,
        weekdays: ['mon', 'tue'],
      },
    ])
    expect(migrated.occurrence_exceptions).toEqual({
      public_holiday: true,
      sick_leave: false,
    })
    expect(migrated.shift_assignments).toEqual([
      { shift_id: 'morning', employee_ids: [], team_ids: ['t1'] },
      { shift_id: 'night', employee_ids: ['e1'], team_ids: [] },
    ])
    expect(migrated).not.toHaveProperty('occurrence')
    expect(migrated).not.toHaveProperty('day_coverage')
    expect(scheduleSchema.safeParse(migrated).success).toBe(true)
  })

  it('passes current and non-fixed records through untouched', () => {
    const current = { ...legacy, occurrence: undefined }
    delete (current as Record<string, unknown>).occurrence
    expect(migrateLegacyFixedSchedule(current)).toBe(current)
    const rotate = { type: 'rotate', occurrence: {} }
    expect(migrateLegacyFixedSchedule(rotate)).toBe(rotate)
  })
})
