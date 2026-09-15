import { z } from 'zod'
import { addDays, addWeeks, parse } from 'date-fns'
import { describe, expect, it } from 'vitest'
import employeeData from '@/features/employees/data/data.json'
import { type Employee, EmployeeSchema } from '@/features/employees/data/schema'
import { sampleSchedules } from '@/features/schedules/data/schedules.fixtures'
import { scheduleSchema } from '@/features/schedules/data/schema'
import { shiftSchema } from '@/features/shifts/data/schema'
import { defaultShifts } from '@/features/shifts/data/shifts'
import { teamSchema } from '@/features/teams/data/schema'
import { defaultTeams } from '@/features/teams/data/teams'
import { type RotateSchedule, buildRotation, isRotateSchedule } from './utils'

// Locks the sample rotation scenarios in `schedules/data/schedules.fixtures.ts`
// — fixtures, not seeds (the app ships with no schedules), but the worked
// examples the rotate model is documented against.
//
//   Shift Rotation    Team A, 4 crew, Morning / Afternoon / Night / Off
//   Desk Alternation  Team B, 3 crew, Early / Late / Off
//
// The rest of the sample set is checked more lightly: that it parses, and that
// every rotate cycle staffs every selected shift on every day.
//
// Shifts, teams and employees are still seeded, so checking those against
// their own zod schemas is load-bearing: the stores parse them at runtime and
// would silently fall back to the bundled defaults otherwise.

const employees = employeeData as Employee[]

function rotateSchedule(name: string): RotateSchedule {
  const schedule = sampleSchedules.find((s) => s.name === name)
  if (!schedule || !isRotateSchedule(schedule)) {
    throw new Error('No sample rotate schedule named ' + name)
  }
  return schedule
}

const rotation = rotateSchedule('Shift Rotation')
const alternation = rotateSchedule('Desk Alternation')

function startOf(schedule: RotateSchedule): Date {
  return parse(schedule.start_date, 'yyyy-MM-dd', new Date())
}

// Who is on what `offsetWeeks` after the schedule's own start, keyed by first
// name.
function gridForWeek(
  schedule: RotateSchedule,
  offsetWeeks: number
): Record<string, string> {
  const built = buildRotation(
    schedule,
    defaultShifts,
    employees,
    defaultTeams,
    addWeeks(startOf(schedule), offsetWeeks),
    'weekly'
  )
  expect(built.periodIndex).toBe(offsetWeeks)
  return Object.fromEntries(
    built.rows.map((row) => [row.employee.firstname, row.assigned.label])
  )
}

describe('sample data', () => {
  it('parses against its own schemas', () => {
    expect(z.array(EmployeeSchema).safeParse(employeeData).success).toBe(true)
    expect(z.array(shiftSchema).safeParse(defaultShifts).success).toBe(true)
    expect(z.array(teamSchema).safeParse(defaultTeams).success).toBe(true)
    expect(z.array(scheduleSchema).safeParse(sampleSchedules).success).toBe(
      true
    )
  })

  it('covers the demo rotations plus the wider 24/7 sample', () => {
    expect(employees).toHaveLength(30)
    expect(defaultShifts.map((s) => s.name)).toEqual([
      'Morning',
      'Afternoon',
      'Night',
      'Early',
      'Late',
      'Day 12h',
      'Night 12h',
      'Office',
    ])
    expect(sampleSchedules.map((s) => s.id)).toEqual([
      'sched-rotation',
      'sched-alternation',
      'sched-panama-223',
      'sched-security-dupont',
      'sched-security-223',
      'sched-factory-continental',
      'sched-factory-swing',
      'sched-hospital-pitman',
      'sched-office-weekdays',
    ])
    expect(defaultTeams.map((t) => [t.name, t.employee_ids.length])).toEqual([
      ['Team A', 4],
      ['Team B', 3],
      ['Guard Alpha', 2],
      ['Guard Bravo', 2],
      ['Guard Charlie', 2],
      ['Guard Delta', 2],
      ['Line Blue', 2],
      ['Line Gold', 2],
      ['Line Red', 2],
      ['Line Green', 2],
      ['Head Office', 3],
    ])
  })

  it('gives each rotation one crew per cycle position', () => {
    for (const schedule of [rotation, alternation]) {
      const crew = schedule.day_coverage.flatMap((cell) => [
        ...cell.employee_ids,
        ...cell.team_ids,
      ])
      expect(new Set(crew).size).toBe(schedule.pattern.length)
    }
  })

  it('staffs every selected shift on every day of every sample cycle', () => {
    // The pattern supplies the rhythm, `shift_ids` supplies what has to run,
    // and nothing is left uncovered.
    for (const schedule of sampleSchedules.filter(isRotateSchedule)) {
      const staffed = new Set(
        schedule.day_coverage
          .filter((cell) => cell.employee_ids.length || cell.team_ids.length)
          .map((cell) => `${cell.day}:${cell.shift_id}`)
      )
      expect(staffed.size).toBe(
        schedule.pattern.length * schedule.shift_ids.length
      )
    }
  })

  it('starts both cycles on a Monday, so period 0 is the start-date week', () => {
    expect(startOf(rotation).getDay()).toBe(1)
    expect(startOf(alternation).getDay()).toBe(1)
  })

  // The shifts still carry their own "Assign to" picks (Morning names Amir,
  // Early/Late name Team B), but none of it should reach the rotation.
  it('builds the roster from the schedule, not from the shifts', () => {
    const stripped = defaultShifts.map((shift) => ({
      ...shift,
      employee_ids: [],
      team_ids: [],
    }))

    for (const schedule of [rotation, alternation]) {
      const asSeeded = buildRotation(
        schedule,
        defaultShifts,
        employees,
        defaultTeams,
        startOf(schedule),
        'weekly'
      )
      const withoutShiftPicks = buildRotation(
        schedule,
        stripped,
        employees,
        defaultTeams,
        startOf(schedule),
        'weekly'
      )
      expect(asSeeded.rows).toHaveLength(schedule.pattern.length)
      expect(
        withoutShiftPicks.rows.map((r) => [r.employeeId, r.assigned.label])
      ).toEqual(asSeeded.rows.map((r) => [r.employeeId, r.assigned.label]))
    }
  })
})

describe('Shift Rotation — Team A, three shifts and a rest slot', () => {
  it('gives each crew a different shift in week 1, with one off', () => {
    expect(gridForWeek(rotation, 0)).toEqual({
      Amir: 'Morning',
      Bilal: 'Afternoon',
      Carla: 'Night',
      Dana: 'Off',
    })
  })

  it('advances every crew one position per week', () => {
    expect(gridForWeek(rotation, 1)).toEqual({
      Amir: 'Afternoon',
      Bilal: 'Night',
      Carla: 'Off',
      Dana: 'Morning',
    })
    expect(gridForWeek(rotation, 2)).toEqual({
      Amir: 'Night',
      Bilal: 'Off',
      Carla: 'Morning',
      Dana: 'Afternoon',
    })
    expect(gridForWeek(rotation, 3)).toEqual({
      Amir: 'Off',
      Bilal: 'Morning',
      Carla: 'Afternoon',
      Dana: 'Night',
    })
  })

  it('wraps back to the starting grid on the fifth week', () => {
    expect(gridForWeek(rotation, 4)).toEqual(gridForWeek(rotation, 0))
  })

  it('covers every shift exactly once per week, every week', () => {
    for (let week = 0; week < 8; week++) {
      const assignments = Object.values(gridForWeek(rotation, week))
      expect([...assignments].sort()).toEqual([
        'Afternoon',
        'Morning',
        'Night',
        'Off',
      ])
    }
  })
})

describe('Desk Alternation — Team B, two shifts and a rest slot', () => {
  it('gives each crew a different shift in week 1, with one off', () => {
    expect(gridForWeek(alternation, 0)).toEqual({
      Elias: 'Early',
      Farah: 'Late',
      Ghassan: 'Off',
    })
  })

  it('advances every crew one position per week', () => {
    expect(gridForWeek(alternation, 1)).toEqual({
      Elias: 'Late',
      Farah: 'Off',
      Ghassan: 'Early',
    })
    expect(gridForWeek(alternation, 2)).toEqual({
      Elias: 'Off',
      Farah: 'Early',
      Ghassan: 'Late',
    })
  })

  it('wraps back to the starting grid on the fourth week', () => {
    expect(gridForWeek(alternation, 3)).toEqual(gridForWeek(alternation, 0))
  })

  it('covers every shift exactly once per week, every week', () => {
    for (let week = 0; week < 6; week++) {
      const assignments = Object.values(gridForWeek(alternation, week))
      expect([...assignments].sort()).toEqual(['Early', 'Late', 'Off'])
    }
  })
})

// Read on the Daily tab: a pure rest mask, one card per day, crews pinned to
// a shift rather than rotating through the pattern.
const panama = rotateSchedule('Plant Coverage (2-2-3)')

// Who is on what `offsetDays` after the schedule's own start.
function gridForDay(
  schedule: RotateSchedule,
  offsetDays: number
): Record<string, string> {
  const built = buildRotation(
    schedule,
    defaultShifts,
    employees,
    defaultTeams,
    addDays(startOf(schedule), offsetDays),
    'daily'
  )
  expect(built.periodIndex).toBe(offsetDays)
  return Object.fromEntries(
    built.rows.map((row) => [row.employee.firstname, row.assigned.label])
  )
}

describe('Plant Coverage (2-2-3) — daily, four crews, pinned shifts', () => {
  it('parses against the real schema', () => {
    expect(scheduleSchema.safeParse(panama).success).toBe(true)
  })

  it('runs a fourteen-day cycle, one card per day', () => {
    expect(panama.pattern).toHaveLength(14)
    expect(panama.cycle_length.days).toBe(14)
  })

  it('puts exactly two crews on duty every day of the cycle', () => {
    for (let day = 0; day < 14; day++) {
      const working = Object.values(gridForDay(panama, day)).filter(
        (label) => label !== 'Off'
      )
      expect(working, `day ${day}`).toHaveLength(2)
    }
  })

  it('covers mornings and nights on every single day', () => {
    for (let day = 0; day < 14; day++) {
      const working = Object.values(gridForDay(panama, day)).filter(
        (label) => label !== 'Off'
      )
      expect([...working].sort(), `day ${day}`).toEqual(['Morning', 'Night'])
    }
  })

  it('keeps each crew on its own shift for the whole cycle', () => {
    const seen: Record<string, Set<string>> = {}
    for (let day = 0; day < 14; day++) {
      Object.entries(gridForDay(panama, day)).forEach(([name, label]) => {
        if (label === 'Off') return
        seen[name] = seen[name] ?? new Set()
        seen[name].add(label)
      })
    }
    expect(seen.Amir).toEqual(new Set(['Morning']))
    expect(seen.Carla).toEqual(new Set(['Morning']))
    expect(seen.Bilal).toEqual(new Set(['Night']))
    expect(seen.Dana).toEqual(new Set(['Night']))
  })

  it('gives every crew the same amount of work across the cycle', () => {
    const workedDays: Record<string, number> = {}
    for (let day = 0; day < 14; day++) {
      Object.entries(gridForDay(panama, day)).forEach(([name, label]) => {
        workedDays[name] = (workedDays[name] ?? 0) + (label === 'Off' ? 0 : 1)
      })
    }
    expect(Object.values(workedDays)).toEqual([7, 7, 7, 7])
  })

  it('wraps back to the starting grid on day fifteen', () => {
    expect(gridForDay(panama, 14)).toEqual(gridForDay(panama, 0))
  })
})
