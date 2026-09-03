import { z } from 'zod'
import { addDays, addWeeks, parse } from 'date-fns'
import { describe, expect, it } from 'vitest'
import employeeData from '@/features/employees/data/data.json'
import { type Employee, EmployeeSchema } from '@/features/employees/data/schema'
import { defaultSchedules } from '@/features/schedules/data/schedules'
import { scheduleSchema } from '@/features/schedules/data/schema'
import { shiftSchema } from '@/features/shifts/data/schema'
import { defaultShifts } from '@/features/shifts/data/shifts'
import { teamSchema } from '@/features/teams/data/schema'
import { defaultTeams } from '@/features/teams/data/teams'
import { type RotateSchedule, buildRotation, isRotateSchedule } from './utils'

// Locks the two scenarios this checkout is seeded for. Both are the same
// shape at different sizes: one cycle position per shift plus a rest slot,
// one crew per position, advancing one position per week — so every crew
// covers every shift and exactly one is off at a time.
//
//   Shift Rotation    Team A, 4 crew, Morning / Afternoon / Night / Off
//   Desk Alternation  Team B, 3 crew, Early / Late / Off
//
// The seeds are the app's real starting data, so this doubles as a check
// that they still satisfy their own zod schemas — the stores parse them at
// runtime and would silently fall back to the bundled defaults otherwise.

const employees = employeeData as Employee[]

function rotateSchedule(name: string): RotateSchedule {
  const schedule = defaultSchedules.find((s) => s.name === name)
  if (!schedule || !isRotateSchedule(schedule)) {
    throw new Error('No seeded rotate schedule named ' + name)
  }
  return schedule
}

const rotation = rotateSchedule('Shift Rotation')
const alternation = rotateSchedule('Desk Alternation')

function startOf(schedule: RotateSchedule): Date {
  return parse(schedule.start_date, 'yyyy-MM-dd', new Date())
}

// Who is on what in the week `offsetWeeks` after the schedule's own start,
// keyed by first name.
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

describe('seed data', () => {
  it('parses against its own schemas', () => {
    expect(z.array(EmployeeSchema).safeParse(employeeData).success).toBe(true)
    expect(z.array(shiftSchema).safeParse(defaultShifts).success).toBe(true)
    expect(z.array(teamSchema).safeParse(defaultTeams).success).toBe(true)
    expect(z.array(scheduleSchema).safeParse(defaultSchedules).success).toBe(
      true
    )
  })

  it('seeds exactly the three scenarios', () => {
    expect(employees).toHaveLength(7)
    expect(defaultShifts.map((s) => s.name)).toEqual([
      'Morning',
      'Afternoon',
      'Night',
      'Early',
      'Late',
    ])
    expect(defaultSchedules).toHaveLength(3)
    expect(defaultTeams.map((t) => [t.name, t.employee_ids.length])).toEqual([
      ['Team A', 4],
      ['Team B', 3],
    ])
  })

  it('gives each rotation one crew per cycle position', () => {
    for (const schedule of [rotation, alternation]) {
      const crew = schedule.pattern.flatMap((p) => [
        ...(p.employee_ids ?? []),
        ...(p.team_ids ?? []),
      ])
      expect(new Set(crew).size).toBe(schedule.pattern.length)
    }
  })

  it('starts both cycles on a Monday, so period 0 is the start-date week', () => {
    expect(startOf(rotation).getDay()).toBe(1)
    expect(startOf(alternation).getDay()).toBe(1)
  })

  // The shifts still carry their own "Assign to" picks — Morning names Amir,
  // and Early and Late each name the whole of Team B. None of it reaches the
  // rotation any more, which is the point: a shift naming a team used to drop
  // every one of its members onto the same cycle position.
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

// The third seeded scenario is a different shape from the two above and is
// read on the **Daily** tab: a pure rest mask where one card is one day, with
// crews pinned to a shift rather than rotating through the pattern's own.
const panama = rotateSchedule('Plant Coverage (2-2-3)')

// Who is on what on the day `offsetDays` after the schedule's own start.
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
    // The point of the pinned starting positions: the crews pair up
    // differently from day to day, so both shifts are only ever covered
    // because the pins alternate around the cycle those pairings form.
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
    // Seven working cards in the mask, and every crew traverses all of them.
    expect(Object.values(workedDays)).toEqual([7, 7, 7, 7])
  })

  it('wraps back to the starting grid on day fifteen', () => {
    expect(gridForDay(panama, 14)).toEqual(gridForDay(panama, 0))
  })
})
