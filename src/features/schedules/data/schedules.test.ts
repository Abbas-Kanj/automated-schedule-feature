import { describe, expect, it } from 'vitest'
import employeeData from '@/features/employees/data/data.json'
import { type Employee } from '@/features/employees/data/schema'
import { defaultShifts } from '@/features/shifts/data/shifts'
import { defaultTeams } from '@/features/teams/data/teams'
import {
  crewsFromDayCoverage,
  dayCoverageMatchesPlacements,
  orderShiftIdsByStart,
  patternToSlots,
  shiftHoursById,
} from '../rotation-crews'
import { analyzeDayCoverage } from '../rotation-suggestion'
import { employees } from './employees'
import { defaultSchedules } from './schedules'
import { type RegularSchedule, type Schedule, scheduleSchema } from './schema'

// The seeds are the first thing anybody sees, and they are also the only
// worked examples of the model outside the fixtures. A seed that fails its own
// schema, or that quietly leaves a shift unstaffed, teaches the wrong thing —
// so the checks here are the ones the UI would otherwise surface as warnings.

const shiftIds = new Set(defaultShifts.map((shift) => shift.id))
const teamIds = new Set(defaultTeams.map((team) => team.id))
const employeeIds = new Set((employeeData as Employee[]).map((e) => e.id))
const employeeLabels = new Map(employees.map((e) => [e.value, e.label]))

const rotateSeeds = defaultSchedules.filter(
  (schedule): schedule is Extract<RegularSchedule, { type: 'rotate' }> =>
    schedule.parent_type === 'regular' && schedule.type === 'rotate'
)
const fixedSeeds = defaultSchedules.filter(
  (schedule): schedule is Extract<RegularSchedule, { type: 'fixed' }> =>
    schedule.parent_type === 'regular' && schedule.type === 'fixed'
)

describe('seeded schedules', () => {
  it('ships 3 fixed and 4 rotate schedules', () => {
    expect(fixedSeeds).toHaveLength(3)
    expect(rotateSeeds).toHaveLength(4)
    expect(defaultSchedules).toHaveLength(7)
  })

  it('gives every seed a unique id', () => {
    const ids = defaultSchedules.map((schedule) => schedule.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(defaultSchedules.map((s): [string, Schedule] => [s.name, s]))(
    'validates %s against scheduleSchema',
    (_name, schedule) => {
      const result = scheduleSchema.safeParse(schedule)
      // Print the real issues rather than a bare `false`.
      expect(result.success ? [] : result.error.issues).toEqual([])
    }
  )

  it.each(defaultSchedules.map((s): [string, Schedule] => [s.name, s]))(
    '%s references only shifts that exist',
    (_name, schedule) => {
      if (schedule.parent_type !== 'regular') return
      schedule.shift_ids.forEach((id) => expect(shiftIds).toContain(id))
    }
  )
})

describe('seeded rotations', () => {
  it.each(rotateSeeds.map((s): [string, typeof s] => [s.name, s]))(
    '%s keeps day_coverage in step with crew_placements',
    (_name, schedule) => {
      const ordered = orderShiftIdsByStart(schedule.shift_ids, defaultShifts)
      expect(
        dayCoverageMatchesPlacements(
          patternToSlots(schedule.pattern),
          schedule.crew_placements,
          ordered,
          schedule.day_coverage
        )
      ).toBe(true)
    }
  )

  it.each(rotateSeeds.map((s): [string, typeof s] => [s.name, s]))(
    '%s staffs every shift on every cycle day',
    (_name, schedule) => {
      const ordered = orderShiftIdsByStart(schedule.shift_ids, defaultShifts)
      // Employee crews carrying no label are dropped as unknown, which would
      // read here as an empty roster rather than a failure.
      const crews = crewsFromDayCoverage(
        schedule.day_coverage,
        defaultTeams,
        employeeLabels
      )
      expect(crews).toHaveLength(schedule.crew_placements.length)
      const { coverage } = analyzeDayCoverage(
        crews,
        ordered,
        schedule.pattern.length,
        { shiftHours: shiftHoursById(defaultShifts) }
      )
      const uncovered = coverage
        .filter((day) => day.uncoveredShiftIds.length)
        .map((day) => `day ${day.index}: ${day.uncoveredShiftIds.join(', ')}`)
      expect(uncovered).toEqual([])
    }
  )

  it.each(rotateSeeds.map((s): [string, typeof s] => [s.name, s]))(
    '%s places every crew it names in crew_ids',
    (_name, schedule) => {
      const placed = new Set(schedule.crew_placements.map((p) => p.crew))
      schedule.crew_ids?.forEach((id) =>
        expect(placed).toContain(`${schedule.crew_kind}:${id}`)
      )
      expect(placed.size).toBe(schedule.crew_ids?.length)
    }
  )

  it.each(rotateSeeds.map((s): [string, typeof s] => [s.name, s]))(
    '%s names only real teams and employees',
    (_name, schedule) => {
      schedule.crew_placements.forEach(({ crew }) => {
        const [kind, id] = crew.split(':')
        expect(kind === 'team' ? teamIds : employeeIds).toContain(id)
      })
    }
  )
})

describe('seeded fixed schedules', () => {
  it.each(fixedSeeds.map((s): [string, typeof s] => [s.name, s]))(
    '%s gives every selected shift exactly one occurrence and one assignment',
    (_name, schedule) => {
      schedule.shift_ids.forEach((id) => {
        expect(
          schedule.shift_occurrences.filter((row) => row.shift_id === id)
        ).toHaveLength(1)
        expect(
          schedule.shift_assignments.filter((row) => row.shift_id === id)
        ).toHaveLength(1)
      })
    }
  )

  it.each(fixedSeeds.map((s): [string, typeof s] => [s.name, s]))(
    '%s assigns crews that exist and match its crew_kind',
    (_name, schedule) => {
      schedule.shift_assignments.forEach((assignment) => {
        const used =
          schedule.crew_kind === 'team'
            ? assignment.team_ids
            : assignment.employee_ids
        const unused =
          schedule.crew_kind === 'team'
            ? assignment.employee_ids
            : assignment.team_ids
        expect(used.length).toBeGreaterThan(0)
        expect(unused).toEqual([])
        used.forEach((id) =>
          expect(
            schedule.crew_kind === 'team' ? teamIds : employeeIds
          ).toContain(id)
        )
      })
    }
  )
})

// The point of seven seeds rather than two is breadth: if a future edit
// collapses them onto the same arm, these fail rather than silently narrowing
// what a new developer sees on first run.
describe('seeds span the model', () => {
  it('covers both rotate cycle types', () => {
    expect(new Set(rotateSeeds.map((s) => s.cycle_type))).toEqual(
      new Set(['pattern_shifts', 'custom_shifts'])
    )
  })

  it('covers all three occurrence frequencies', () => {
    const frequencies = fixedSeeds.flatMap((s) =>
      s.shift_occurrences.map((row) => row.frequency)
    )
    expect(new Set(frequencies)).toEqual(
      new Set(['daily', 'weekly', 'monthly'])
    )
  })

  it('covers all three end types', () => {
    const endTypes = defaultSchedules
      .filter((s) => s.parent_type === 'regular')
      .map((s) => s.end_settings.end_type)
    expect(new Set(endTypes)).toEqual(
      new Set(['never', 'on_date', 'after_occurrences'])
    )
  })

  it('draws crews both as teams and as individuals', () => {
    expect(new Set(rotateSeeds.map((s) => s.crew_kind))).toEqual(
      new Set(['team', 'employee'])
    )
    expect(new Set(fixedSeeds.map((s) => s.crew_kind))).toEqual(
      new Set(['team', 'employee'])
    )
  })

  it('varies the crew count across rotations', () => {
    const counts = rotateSeeds.map((s) => s.crew_placements.length)
    expect(counts).toEqual([4, 4, 4, 3])
  })
})
