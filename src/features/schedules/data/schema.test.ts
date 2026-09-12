import { describe, expect, it } from 'vitest'
import { type Schedule, scheduleSchema } from './schema'

// `scheduleSchema` is the source of truth for what a schedule may be, and its
// rotate arm carries the cross-field rules nothing else enforces — pattern
// length against cycle length, cells against the selected shifts, placements
// against the cycle. These exercise those rules directly, since the form only
// ever reaches them through several steps of UI.

const common = {
  id: 'sched-1',
  name: 'Plant coverage',
  description: '',
}

const endSettings = { end_type: 'never' as const }

function rotate(overrides: Record<string, unknown> = {}) {
  return {
    ...common,
    parent_type: 'regular' as const,
    type: 'rotate' as const,
    shift_ids: ['shift-morning', 'shift-night'],
    temporary_schedule: false,
    start_date: '2026-01-05',
    end_settings: endSettings,
    cycle_type: 'pattern_shifts' as const,
    cycle_length: { unit: 'custom_days' as const, days: 4 },
    pattern: [
      { position: 1, shift_id: 'shift-morning', is_off: false },
      { position: 2, shift_id: 'shift-morning', is_off: false },
      { position: 3, shift_id: 'shift-night', is_off: false },
      { position: 4, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [],
    crew_placements: [],
    ...overrides,
  }
}

function fixed(overrides: Record<string, unknown> = {}) {
  return {
    ...common,
    parent_type: 'regular' as const,
    type: 'fixed' as const,
    shift_ids: ['shift-morning'],
    temporary_schedule: false,
    start_date: '2026-01-05',
    end_settings: endSettings,
    ...overrides,
  }
}

// The first message for a path, so a failing expectation names the rule rather
// than dumping the whole issue list.
function errorsAt(value: unknown, path: string): string[] {
  const result = scheduleSchema.safeParse(value)
  if (result.success) return []
  return result.error.issues
    .filter((issue) => issue.path.join('.') === path)
    .map((issue) => issue.message)
}

function parses(value: unknown): boolean {
  return scheduleSchema.safeParse(value).success
}

describe('regular schedules', () => {
  it('accepts a well-formed rotate schedule', () => {
    expect(parses(rotate())).toBe(true)
  })

  it('accepts a fixed schedule with a single shift', () => {
    expect(parses(fixed())).toBe(true)
  })

  it('rejects the same shift selected twice', () => {
    expect(
      errorsAt(
        fixed({ shift_ids: ['shift-morning', 'shift-morning'] }),
        'shift_ids'
      )
    ).toContain('Each shift can only be selected once')
  })

  // A rotation with one shift has nothing to rotate through; fixed and flexible
  // are perfectly happy with one.
  it('needs at least two shifts to rotate, unlike fixed', () => {
    expect(
      errorsAt(rotate({ shift_ids: ['shift-morning'] }), 'shift_ids')
    ).toContain('Select at least 2 shifts to build a rotation')
    expect(parses(fixed({ shift_ids: ['shift-morning'] }))).toBe(true)
  })
})

describe('rotate pattern', () => {
  it('requires one card per cycle day', () => {
    const short = rotate({
      cycle_length: { unit: 'custom_days', days: 5 },
    })
    expect(errorsAt(short, 'pattern')).toContain(
      'Assign all 5 day(s) of the cycle'
    )
  })

  it('rejects a repeated cycle position', () => {
    const duplicated = rotate({
      pattern: [
        { position: 1, shift_id: 'shift-morning', is_off: false },
        { position: 1, shift_id: 'shift-morning', is_off: false },
        { position: 3, shift_id: 'shift-night', is_off: false },
        { position: 4, is_off: true },
      ],
    })
    expect(errorsAt(duplicated, 'pattern')).toContain(
      'Each cycle day can only appear once'
    )
  })

  it('makes a working card name a shift', () => {
    const blank = rotate({
      pattern: [
        { position: 1, is_off: false },
        { position: 2, shift_id: 'shift-morning', is_off: false },
        { position: 3, shift_id: 'shift-night', is_off: false },
        { position: 4, is_off: true },
      ],
    })
    expect(errorsAt(blank, 'pattern.0.shift_id')).toContain(
      'Select a shift or mark as day off'
    )
  })

  it('lets a rest card have no shift', () => {
    expect(parses(rotate())).toBe(true)
  })
})

describe('rotate day coverage', () => {
  const cell = (overrides: Record<string, unknown> = {}) => ({
    day: 0,
    shift_id: 'shift-morning',
    employee_ids: ['emp-a'],
    team_ids: [],
    ...overrides,
  })

  it('accepts cells inside the cycle naming selected shifts', () => {
    expect(
      parses(
        rotate({
          day_coverage: [cell(), cell({ day: 3, shift_id: 'shift-night' })],
        })
      )
    ).toBe(true)
  })

  it('rejects a cell naming a shift the schedule does not run', () => {
    expect(
      errorsAt(
        rotate({ day_coverage: [cell({ shift_id: 'shift-swing' })] }),
        'day_coverage.0.shift_id'
      )
    ).toContain('Assigned shift is not one of this schedule’s shifts')
  })

  it('rejects a cell past the end of the cycle', () => {
    expect(
      errorsAt(
        rotate({ day_coverage: [cell({ day: 4 })] }),
        'day_coverage.0.day'
      )
    ).toContain('Assigned day falls outside the cycle')
  })

  it('rejects two cells for the same day and shift', () => {
    expect(
      errorsAt(
        rotate({ day_coverage: [cell(), cell({ employee_ids: ['emp-b'] })] }),
        'day_coverage.1'
      )
    ).toContain('Each shift can only be assigned once per cycle day')
  })

  // The whole point of the warn-don't-block rule: an unstaffed shift is
  // reported by the coverage panel, never by validation, so "Next" advances.
  it('accepts a rotation that leaves shifts unstaffed', () => {
    expect(parses(rotate({ day_coverage: [] }))).toBe(true)
  })
})

describe('rotate crew placements', () => {
  const placement = (overrides: Record<string, unknown> = {}) => ({
    crew: 'team:team-a',
    day_offset: 0,
    shift_step: 0,
    ...overrides,
  })

  it('accepts offsets inside the cycle and steps inside the shift list', () => {
    expect(
      parses(
        rotate({
          crew_placements: [
            placement(),
            placement({ crew: 'team:team-b', day_offset: 2, shift_step: 1 }),
          ],
        })
      )
    ).toBe(true)
  })

  it('rejects a start day past the end of the cycle', () => {
    expect(
      errorsAt(
        rotate({ crew_placements: [placement({ day_offset: 4 })] }),
        'crew_placements.0.day_offset'
      )
    ).toContain('Crew start day falls outside the cycle')
  })

  it('rejects a shift step past the end of the shift list', () => {
    expect(
      errorsAt(
        rotate({ crew_placements: [placement({ shift_step: 2 })] }),
        'crew_placements.0.shift_step'
      )
    ).toContain('Shift track falls outside this schedule’s shifts')
  })

  it('rejects the same crew placed twice', () => {
    expect(
      errorsAt(
        rotate({
          crew_placements: [placement(), placement({ day_offset: 1 })],
        }),
        'crew_placements.1.crew'
      )
    ).toContain('Each crew can only be placed once')
  })

  // Placements are a record of how the matrix was generated, not a second
  // source of truth, so one that no longer describes the cells still parses —
  // the "Assign to" step reports the mismatch in place.
  it('accepts placements that do not describe the stored matrix', () => {
    expect(
      parses(
        rotate({
          crew_placements: [placement()],
          day_coverage: [
            {
              day: 2,
              shift_id: 'shift-night',
              employee_ids: ['emp-z'],
              team_ids: [],
            },
          ],
        })
      )
    ).toBe(true)
  })
})

describe('rotate custom_shifts mode', () => {
  function customShifts(overrides: Record<string, unknown> = {}) {
    return rotate({
      cycle_type: 'custom_shifts',
      pattern: [
        { position: 1, shift_id: 'shift-morning', is_off: false },
        { position: 2, shift_id: 'shift-morning', is_off: false },
        { position: 3, shift_id: 'shift-night', is_off: false },
      ],
      shift_repeat: [
        {
          shift_id: 'shift-morning',
          frequency: 'daily',
          interval: 2,
        },
        {
          shift_id: 'shift-night',
          frequency: 'daily',
          interval: 1,
        },
      ],
      ...overrides,
    })
  }

  // The pattern's length is the sum of the intervals, not cycle_length.days.
  it('sizes the pattern from the repeat intervals', () => {
    expect(parses(customShifts())).toBe(true)
  })

  it('rejects a pattern that does not match the interval sum', () => {
    const extra = customShifts({
      pattern: [
        { position: 1, shift_id: 'shift-morning', is_off: false },
        { position: 2, shift_id: 'shift-morning', is_off: false },
      ],
    })
    expect(errorsAt(extra, 'pattern')).toContain(
      'Pattern must have 3 card(s) based on shift repeat settings'
    )
  })

  it('requires at least one repeat configuration', () => {
    const none = customShifts({ shift_repeat: [], pattern: [] })
    expect(errorsAt(none, 'shift_repeat')).toContain(
      'Add at least one shift repeat configuration'
    )
  })

  it('rejects a repeat row for a shift not selected', () => {
    const stray = customShifts({
      shift_repeat: [
        { shift_id: 'shift-morning', frequency: 'daily', interval: 2 },
        { shift_id: 'shift-swing', frequency: 'daily', interval: 1 },
      ],
    })
    expect(errorsAt(stray, 'shift_repeat')).toContain(
      'Shift repeat references a shift not in the selection'
    )
  })

  // The safety net behind the pattern grid, which disables an exhausted shift.
  it('rejects a shift used on more cards than its interval allows', () => {
    const overused = customShifts({
      pattern: [
        { position: 1, shift_id: 'shift-morning', is_off: false },
        { position: 2, shift_id: 'shift-morning', is_off: false },
        { position: 3, shift_id: 'shift-morning', is_off: false },
      ],
    })
    expect(errorsAt(overused, 'pattern')).toContain(
      'This shift is assigned to 3 day(s) in the pattern, but its repeat settings only allow 2'
    )
  })

  it('requires weekdays on a weekly repeat', () => {
    const weekly = customShifts({
      shift_repeat: [
        { shift_id: 'shift-morning', frequency: 'weekly', interval: 2 },
        { shift_id: 'shift-night', frequency: 'daily', interval: 1 },
      ],
    })
    expect(errorsAt(weekly, 'shift_repeat.0.weekdays')).toContain(
      'Select at least one day'
    )
  })

  it('requires a mode on a monthly repeat, then that mode’s own fields', () => {
    const noMode = customShifts({
      shift_repeat: [
        { shift_id: 'shift-morning', frequency: 'monthly', interval: 2 },
        { shift_id: 'shift-night', frequency: 'daily', interval: 1 },
      ],
    })
    expect(errorsAt(noMode, 'shift_repeat.0.monthly_mode')).toContain(
      'Select how it repeats monthly'
    )

    const noDay = customShifts({
      shift_repeat: [
        {
          shift_id: 'shift-morning',
          frequency: 'monthly',
          interval: 2,
          monthly_mode: 'day_month',
        },
        { shift_id: 'shift-night', frequency: 'daily', interval: 1 },
      ],
    })
    expect(errorsAt(noDay, 'shift_repeat.0.day_of_month')).toContain(
      'Select the day of the month'
    )
  })
})

describe('end settings', () => {
  it('requires a count when ending after occurrences', () => {
    expect(
      errorsAt(
        fixed({ end_settings: { end_type: 'after_occurrences' } }),
        'end_settings.end_occurrences'
      )
    ).toContain('Set the number of occurrences')
  })

  it('requires a date when ending on a date', () => {
    expect(
      errorsAt(
        fixed({ end_settings: { end_type: 'on_date' } }),
        'end_settings.end_date'
      )
    ).toContain('Set the end date')
  })

  it('needs nothing else when it never ends', () => {
    expect(parses(fixed({ end_settings: { end_type: 'never' } }))).toBe(true)
  })
})

describe('daily schedules', () => {
  const weeklyOne = {
    ...common,
    parent_type: 'daily' as const,
    type: 'weekly_one' as const,
    days: [
      {
        day: 'monday' as const,
        times: [{ from_time: '09:00', to_time: '17:00' }],
      },
    ],
    employees: [{ value: 'emp-a', label: 'Amir' }],
  }

  it('accepts a weekly_one schedule', () => {
    expect(parses(weeklyOne)).toBe(true)
  })

  it('rejects the same weekday twice', () => {
    expect(
      errorsAt(
        {
          ...weeklyOne,
          days: [
            {
              day: 'monday',
              times: [{ from_time: '09:00', to_time: '17:00' }],
            },
            {
              day: 'monday',
              times: [{ from_time: '18:00', to_time: '20:00' }],
            },
          ],
        },
        'days'
      )
    ).toContain('Each day can only be selected once')
  })

  it('rejects a time range that ends before it starts', () => {
    expect(
      errorsAt(
        {
          ...weeklyOne,
          days: [
            {
              day: 'monday',
              times: [{ from_time: '17:00', to_time: '09:00' }],
            },
          ],
        },
        'days.0.times.0.to_time'
      )
    ).toContain('End time must be after start time')
  })

  it('requires at least one employee', () => {
    expect(errorsAt({ ...weeklyOne, employees: [] }, 'employees')).toContain(
      'Select at least one employee'
    )
  })
})

describe('parsed shape', () => {
  // A saved schedule reaching the store without the newer rotate fields still
  // loads — they default rather than failing the parse.
  it('defaults the rotate roster fields when a stored schedule omits them', () => {
    const legacy = rotate()
    delete (legacy as Record<string, unknown>).day_coverage
    delete (legacy as Record<string, unknown>).crew_placements
    delete (legacy as Record<string, unknown>).shift_repeat

    const parsed = scheduleSchema.parse(legacy) as Extract<
      Schedule,
      { type: 'rotate' }
    >
    expect(parsed.day_coverage).toEqual([])
    expect(parsed.crew_placements).toEqual([])
    expect(parsed.shift_repeat).toEqual([])
  })
})
