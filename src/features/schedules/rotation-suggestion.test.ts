import { describe, expect, it } from 'vitest'
import { ROTATION_PRESETS, getRotationPreset } from './data/rotation-presets'
import {
  type CrewAssignment,
  type SuggestionCrew,
  type SuggestionSlot,
  analyzeRotation,
  suggestRotationAssignment,
} from './rotation-suggestion'

// Builds slots the way the form does: a card list of shift ids, `null` meaning
// a rest card.
function makeSlots(cards: (string | null)[]): SuggestionSlot[] {
  return cards.map((shiftId, index) => ({
    index,
    shiftId: shiftId ?? undefined,
    isOff: shiftId === null,
  }))
}

function makeCrews(
  count: number,
  overrides: Partial<SuggestionCrew> = {}
): SuggestionCrew[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `crew-${i + 1}`,
    kind: 'team' as const,
    label: `Crew ${i + 1}`,
    employeeIds: [`emp-${i + 1}`],
    ...overrides,
  }))
}

function slotsFromPreset(presetId: string, shifts: string[]): SuggestionSlot[] {
  const preset = getRotationPreset(presetId)
  if (!preset) throw new Error(`unknown preset ${presetId}`)
  return makeSlots(
    preset
      .buildCards(shifts.length)
      .map((card) => (card === null ? null : shifts[card]))
  )
}

function offsetsOf(assignments: CrewAssignment[]): number[] {
  return assignments.map((assignment) => assignment.offset)
}

function severities(warnings: { severity: string }[]): string[] {
  return warnings.map((warning) => warning.severity)
}

describe('suggestRotationAssignment', () => {
  it('spreads four crews across a 2-2-3 Panama cycle with flat coverage', () => {
    const slots = slotsFromPreset('two_two_three', ['day'])
    expect(slots).toHaveLength(14)

    const result = suggestRotationAssignment(slots, makeCrews(4))

    // 7 working cards x 4 crews / 14 days = exactly 2 on duty, every day.
    expect(result.coverage.map((day) => day.onDuty)).toEqual(Array(14).fill(2))
    expect(severities(result.warnings)).not.toContain('warning')
    expect(severities(result.warnings)).not.toContain('error')
  })

  it('gives one crew per position on a shift-per-card cycle', () => {
    const slots = makeSlots(['morning', 'afternoon', 'night', null])
    const result = suggestRotationAssignment(slots, makeCrews(4))

    expect(offsetsOf(result.assignments)).toEqual([0, 1, 2, 3])
    // Every shift covered by exactly one crew on every day of the cycle.
    result.coverage.forEach((day) => {
      expect(day.onDuty).toBe(3)
      expect(Object.values(day.byShiftId)).toEqual([1, 1, 1])
    })
    expect(result.warnings).toEqual([])
  })

  it('keeps coverage flat on every preset at its suggested crew count', () => {
    const shifts = ['s1', 's2', 's3']
    ROTATION_PRESETS.forEach((preset) => {
      const slots = slotsFromPreset(
        preset.id,
        shifts.slice(0, preset.minShifts)
      )
      const result = suggestRotationAssignment(
        slots,
        makeCrews(preset.suggestedCrews)
      )
      const onDuty = result.coverage.map((day) => day.onDuty)
      const spread = Math.max(...onDuty) - Math.min(...onDuty)

      // Not every system can be perfectly flat, but none of them should swing
      // by more than one crew once the offsets are chosen properly.
      expect(
        spread,
        `${preset.label} swings by ${spread} (${onDuty.join(',')})`
      ).toBeLessThanOrEqual(1)
    })
  })

  it('beats naive even spacing where the pattern is not uniform', () => {
    const slots = slotsFromPreset('dupont', ['day', 'night'])
    expect(slots).toHaveLength(28)

    const crews = makeCrews(4)
    const suggested = suggestRotationAssignment(slots, crews)
    const evenSpacing: CrewAssignment[] = crews.map((crew, k) => ({
      crew,
      offset: Math.floor((k * 28) / 4),
    }))

    expect(suggested.cost).toBeLessThanOrEqual(
      analyzeRotation(slots, evenSpacing).cost
    )
  })

  it('never buys shift balance with a day nobody works', () => {
    // A 5-2 office week alternating two shifts, run by two crews. Landing them
    // on adjacent cards keeps exactly one Morning on duty almost every day —
    // very even, and it shuts the place down on day 5. Coverage of the day
    // comes first: spreading them leaves nobody on duty on no day at all.
    const slots = makeSlots([
      'morning',
      'afternoon',
      'morning',
      'afternoon',
      'morning',
      null,
      null,
    ])

    const result = suggestRotationAssignment(slots, makeCrews(2))

    expect(result.coverage.map((day) => day.onDuty)).not.toContain(0)
    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      'coverage-gap'
    )
  })

  it('leaves an unavoidable gap alone rather than chasing it', () => {
    // One crew on the same week: five working cards for seven days, so two
    // days are empty whatever offset it starts on. The gap penalty is paid by
    // every candidate equally, so it must not distort the choice — and the
    // rest days have to stay where the pattern put them.
    const slots = makeSlots([
      'morning',
      'morning',
      'morning',
      'morning',
      'morning',
      null,
      null,
    ])

    const result = suggestRotationAssignment(slots, makeCrews(1))

    expect(offsetsOf(result.assignments)).toEqual([0])
    expect(result.coverage.map((day) => day.onDuty)).toEqual([
      1, 1, 1, 1, 1, 0, 0,
    ])
    // Nothing to fix, so it must not read as something to go and fix.
    const gap = result.warnings.find(
      (warning) => warning.code === 'coverage-gap'
    )
    expect(gap).toMatchObject({ severity: 'info' })
  })

  it('says how many crews a short-staffed rotation actually needs', () => {
    // Three crews on a three-shifts-plus-rest cycle: one crew is always off, so
    // one shift is always empty. No arrangement fixes that, so it reads as info
    // with the remedy spelled out rather than as something done wrong.
    const slots = makeSlots(['morning', 'afternoon', 'night', null])
    const result = suggestRotationAssignment(slots, makeCrews(3))

    const shortfall = result.warnings.find(
      (warning) => warning.code === 'uncovered-shift'
    )
    expect(shortfall).toMatchObject({ severity: 'info' })
    expect(shortfall?.message).toContain('4 crews would cover every shift')
  })

  it('does not call a correct four-crew Panama roster understaffed', () => {
    // The regression that matters: 4 crews on a 14-day cycle is the textbook
    // answer, and an assumption that crews should equal cycle days flags it as
    // broken.
    const slots = slotsFromPreset('two_two_three', ['day'])
    const result = suggestRotationAssignment(slots, makeCrews(4))
    expect(severities(result.warnings)).not.toContain('warning')
  })

  it('doubles crews up evenly when there are more crews than positions', () => {
    const slots = makeSlots(['morning', 'afternoon', 'night', null])
    const result = suggestRotationAssignment(slots, makeCrews(6))

    const counts = new Map<number, number>()
    offsetsOf(result.assignments).forEach((offset) => {
      counts.set(offset, (counts.get(offset) ?? 0) + 1)
    })
    // Six crews over four positions: two positions doubled, none tripled.
    expect(Math.max(...counts.values())).toBe(2)
    expect(
      result.warnings.find((warning) => warning.code === 'overstaffed')
    ).toMatchObject({ severity: 'info' })
  })

  it('reports a structurally uncoverable shift as info, not a warning', () => {
    // Two crews, three shifts and a rest card: each shift averages half a crew
    // per day, so it cannot be staffed daily however the crews are placed.
    const slots = makeSlots(['morning', 'afternoon', 'night', null])
    const result = suggestRotationAssignment(slots, makeCrews(2))

    const uncovered = result.warnings.filter(
      (warning) => warning.code === 'uncovered-shift'
    )
    expect(uncovered.length).toBeGreaterThan(0)
    uncovered.forEach((warning) => expect(warning.severity).toBe('info'))
  })

  it('covers both shifts of a 28-day day/night flip with only four crews', () => {
    // Naive even spacing (0/3/7/10) puts all four crews in the same half of the
    // cycle on day one, leaving nights empty. Searching on coverage instead
    // straddles the halves and staffs both shifts every day.
    const slots = slotsFromPreset('panama_day_night_flip', ['day', 'night'])
    const result = suggestRotationAssignment(slots, makeCrews(4))

    result.coverage.forEach((day) => {
      expect(day.byShiftId.day ?? 0).toBeGreaterThanOrEqual(1)
      expect(day.byShiftId.night ?? 0).toBeGreaterThanOrEqual(1)
    })
  })

  it('is deterministic', () => {
    const slots = slotsFromPreset('southern_swing', ['day', 'swing', 'night'])
    const first = suggestRotationAssignment(slots, makeCrews(4))
    const second = suggestRotationAssignment(slots, makeCrews(4))
    expect(offsetsOf(first.assignments)).toEqual(offsetsOf(second.assignments))
  })

  it('handles a long cycle without an exhaustive search', () => {
    // 56 cards / 6 crews is far past the exhaustive limit, so this exercises
    // the seeded local-search path.
    const cards = Array.from({ length: 56 }, (_, i) =>
      i % 8 < 4 ? 'day' : null
    )
    const result = suggestRotationAssignment(makeSlots(cards), makeCrews(6))

    expect(result.assignments).toHaveLength(6)
    const onDuty = result.coverage.map((day) => day.onDuty)
    expect(Math.max(...onDuty) - Math.min(...onDuty)).toBeLessThanOrEqual(1)
  })
})

describe('fixed-shift crews', () => {
  it('keeps each crew on its own shift while rest days still rotate', () => {
    // The case a shared pattern cannot express on its own: one 2-2-3 rest mask,
    // two crews permanently on days and two permanently on nights.
    const slots = slotsFromPreset('two_two_three', ['day'])
    const crews: SuggestionCrew[] = [
      {
        key: 'a',
        kind: 'team',
        label: 'A',
        employeeIds: ['1'],
        fixedShiftId: 'day',
      },
      {
        key: 'b',
        kind: 'team',
        label: 'B',
        employeeIds: ['2'],
        fixedShiftId: 'day',
      },
      {
        key: 'c',
        kind: 'team',
        label: 'C',
        employeeIds: ['3'],
        fixedShiftId: 'night',
      },
      {
        key: 'd',
        kind: 'team',
        label: 'D',
        employeeIds: ['4'],
        fixedShiftId: 'night',
      },
    ]

    const result = suggestRotationAssignment(slots, crews)

    // Both shifts staffed every single day of the cycle, and nobody ever
    // appears on a shift that is not their own.
    result.coverage.forEach((day) => {
      expect(day.byShiftId.day ?? 0).toBeGreaterThanOrEqual(1)
      expect(day.byShiftId.night ?? 0).toBeGreaterThanOrEqual(1)
      expect(Object.keys(day.byShiftId).sort()).toEqual(['day', 'night'])
    })
  })
})

describe('analyzeRotation', () => {
  it('grades a hand-made assignment rather than suggesting one', () => {
    const slots = makeSlots(['morning', 'afternoon', 'night', null])
    const crews = makeCrews(4)

    // Everyone piled onto the same starting position.
    const piled: CrewAssignment[] = crews.map((crew) => ({ crew, offset: 0 }))
    const analysis = analyzeRotation(slots, piled)

    expect(analysis.coverage[0].byShiftId.morning).toBe(4)
    expect(
      analysis.warnings.some((warning) => warning.code === 'uncovered-shift')
    ).toBe(true)
  })

  it('warns about a pattern with no rest cards', () => {
    const slots = makeSlots(['morning', 'afternoon'])
    const analysis = analyzeRotation(slots, [
      { crew: makeCrews(1)[0], offset: 0 },
    ])
    expect(
      analysis.warnings.find((warning) => warning.code === 'long-work-run')
    ).toMatchObject({ severity: 'warning' })
  })

  it('reports an empty pattern and an empty crew list as errors', () => {
    expect(analyzeRotation([], []).warnings[0]).toMatchObject({
      code: 'no-positions',
      severity: 'error',
    })
    expect(
      analyzeRotation(makeSlots(['morning', null]), []).warnings[0]
    ).toMatchObject({ code: 'no-crews', severity: 'error' })
  })
})

describe('weekday and weekend checks', () => {
  // 2026-08-31 is a Monday — the anchor the seeded schedules use.
  const monday = new Date(2026, 7, 31)

  it('stays quiet on a Monday-anchored whole-week cycle', () => {
    const slots = slotsFromPreset('two_two_three', ['day'])
    const result = suggestRotationAssignment(slots, makeCrews(4), {
      startDate: monday,
    })

    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      'weekday-anchor'
    )
    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      'weekend-imbalance'
    )
  })

  it('notes when a whole-week cycle does not start on a Monday', () => {
    const slots = slotsFromPreset('five_two', ['day'])
    const wednesday = new Date(2026, 8, 2)
    const result = suggestRotationAssignment(slots, makeCrews(1), {
      startDate: wednesday,
    })

    expect(
      result.warnings.find((warning) => warning.code === 'weekday-anchor')
    ).toMatchObject({ severity: 'info' })
  })

  it('notes that a non-week-multiple cycle drifts across weekdays', () => {
    const slots = slotsFromPreset('four_two', ['day'])
    const result = suggestRotationAssignment(slots, makeCrews(3), {
      startDate: monday,
    })

    expect(
      result.warnings.find((warning) => warning.code === 'weekday-drift')
    ).toMatchObject({ severity: 'info' })
  })
})
