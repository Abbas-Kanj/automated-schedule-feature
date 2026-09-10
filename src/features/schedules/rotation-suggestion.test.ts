import { describe, expect, it } from 'vitest'
import { ROTATION_PRESETS, getRotationPreset } from './data/rotation-presets'
import {
  type CoverageCrew,
  type CrewPlacement,
  type ShiftHours,
  type SuggestionCrew,
  type SuggestionSlot,
  analyzeDayCoverage,
  crewRequirement,
  findQuickTurnarounds,
  placementsToCoverageCrews,
  suggestRotationCoverage,
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

function makeCrews(count: number): SuggestionCrew[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `crew-${i + 1}`,
    kind: 'team' as const,
    label: `Crew ${i + 1}`,
    employeeIds: [`emp-${i + 1}`],
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

function severities(warnings: { severity: string }[]): string[] {
  return warnings.map((warning) => warning.severity)
}

function codes(warnings: { code: string }[]): string[] {
  return warnings.map((warning) => warning.code)
}

function uncoveredCells(coverage: { uncoveredShiftIds: string[] }[]): number {
  return coverage.reduce((sum, day) => sum + day.uncoveredShiftIds.length, 0)
}

// Hand-built placements, so a suggestion can be compared against one.
function place(
  crews: SuggestionCrew[],
  pairs: [number, number][]
): CrewPlacement[] {
  return crews.map((crew, k) => ({
    crew,
    dayOffset: pairs[k][0],
    shiftStep: pairs[k][1],
  }))
}

describe('crewRequirement', () => {
  // Every case here is a number that a *counting* argument gets wrong. The
  // requirement is what the search can actually place, so each one is pinned
  // against `suggestRotationCoverage` rather than against arithmetic.
  function coversWith(
    slots: SuggestionSlot[],
    shifts: string[],
    count: number
  ): boolean {
    const { coverage } = suggestRotationCoverage(
      slots,
      makeCrews(count),
      shifts
    )
    return uncoveredCells(coverage) === 0
  }

  // The trap the 2026-09-06 session recorded: 3 crews is 15 crew-days for 14
  // cells and still cannot do it, because a crew is on one shift for its
  // whole journey. "No red 0" needs 4.
  it('does not mistake crew-days for coverage', () => {
    const shifts = ['a', 'b']
    const slots = makeSlots(['a', 'a', 'a', 'a', 'a', null, null])

    expect(crewRequirement(slots, shifts)).toEqual({
      workDaysPerCrew: 5,
      cellsPerCycle: 14,
      minimumCrews: 4,
      exact: true,
    })
  })

  // Reported from a screenshot: the note said 3 teams, the user picked 3, and
  // day 5 came back with 2 Morning and 0 Afternoon. Counting per shift says 3
  // is enough — 3 crews do own exactly 7 Afternoon-days for 7 cycle days —
  // but no offsets land them on 7 different days.
  it('counts days, not just totals, when a pattern mixes shifts', () => {
    const shifts = ['m', 'a']
    const slots = makeSlots(['m', 'm', 'a', 'a', 'm', null, null])

    expect(crewRequirement(slots, shifts).minimumCrews).toBe(4)
    expect(coversWith(slots, shifts, 3)).toBe(false)
    expect(coversWith(slots, shifts, 4)).toBe(true)
  })

  it('never names a count the search cannot actually fill', () => {
    const cases: [string, (string | null)[], string[]][] = [
      ['uniform 5-2', ['a', 'a', 'a', 'a', 'a', null, null], ['a', 'b']],
      ['mixed 5-2', ['m', 'm', 'a', 'a', 'm', null, null], ['m', 'a']],
      ['alternating week', ['a', 'b', 'a', 'b', 'a', 'b', 'a'], ['a', 'b']],
      ['4-4', ['a', 'a', 'a', 'a', null, null, null, null], ['a', 'b']],
      ['one shift', ['a', 'a', 'a', 'a', 'a', null, null], ['a']],
    ]

    cases.forEach(([name, cards, shifts]) => {
      const slots = makeSlots(cards)
      const { minimumCrews, exact } = crewRequirement(slots, shifts)
      expect(exact, name).toBe(true)
      // The number works...
      expect(coversWith(slots, shifts, minimumCrews), name).toBe(true)
      // ...and nothing smaller does, so it is a minimum and not just a safe
      // over-estimate.
      expect(coversWith(slots, shifts, minimumCrews - 1), name).toBe(false)
    })
  })

  it('reaches the same number on a continuous preset', () => {
    const shifts = ['day', 'night']
    const slots = slotsFromPreset('two_two_three', shifts)
    const { minimumCrews, exact } = crewRequirement(slots, shifts)

    expect(exact).toBe(true)
    expect(minimumCrews).toBe(4)
    expect(coversWith(slots, shifts, 4)).toBe(true)
  })

  it('reports 0 when no card can cover a selected shift', () => {
    expect(crewRequirement(makeSlots([null, null]), ['a', 'b'])).toEqual({
      workDaysPerCrew: 0,
      cellsPerCycle: 4,
      minimumCrews: 0,
      exact: false,
    })
    // A pattern naming only shifts nobody selected covers nothing either.
    expect(
      crewRequirement(makeSlots(['x', 'x']), ['a', 'b']).minimumCrews
    ).toBe(0)
  })
})

describe('the requirement decides whether a hole reads as fixable', () => {
  // The other half of the screenshot bug: under the requirement the panel was
  // telling someone who had just pressed Suggest that there were enough crews
  // and to press it again.
  const shifts = ['m', 'a']
  const slots = makeSlots(['m', 'm', 'a', 'a', 'm', null, null])

  function analyzeSuggestion(count: number, minimumCrews?: number) {
    const { placements } = suggestRotationCoverage(
      slots,
      makeCrews(count),
      shifts
    )
    return analyzeDayCoverage(
      placementsToCoverageCrews(slots, placements, shifts),
      shifts,
      slots.length,
      { minimumCrews }
    )
  }

  it('stops telling an under-crewed roster to suggest an assignment', () => {
    const { minimumCrews } = crewRequirement(slots, shifts)
    const uncoveredWarning = analyzeSuggestion(3, minimumCrews).warnings.find(
      (warning) => warning.code === 'uncovered-shift'
    )

    expect(uncoveredWarning?.severity).toBe('info')
    expect(uncoveredWarning?.message).not.toContain('Suggest an assignment')
    expect(uncoveredWarning?.message).toContain('4 crews')
  })

  it('still calls a genuinely fixable hole fixable', () => {
    // Enough crews, placed badly on purpose — the same message must come back
    // as a warning telling the user to suggest.
    const badly = analyzeDayCoverage(
      placementsToCoverageCrews(
        slots,
        place(makeCrews(4), [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ]),
        shifts
      ),
      shifts,
      slots.length,
      { minimumCrews: 4 }
    )
    const uncoveredWarning = badly.warnings.find(
      (warning) => warning.code === 'uncovered-shift'
    )

    expect(uncoveredWarning?.severity).toBe('warning')
    expect(uncoveredWarning?.message).toContain('Suggest an assignment')
  })
})

describe('suggestRotationCoverage', () => {
  it('spreads four crews across a 2-2-3 Panama cycle with flat coverage', () => {
    const slots = slotsFromPreset('two_two_three', ['day'])
    expect(slots).toHaveLength(14)

    const result = suggestRotationCoverage(slots, makeCrews(4), ['day'])

    // 7 working cards x 4 crews / 14 days = exactly 2 on duty, every day.
    expect(result.coverage.map((day) => day.onDuty)).toEqual(Array(14).fill(2))
    expect(severities(result.warnings)).not.toContain('warning')
    expect(severities(result.warnings)).not.toContain('error')
  })

  it('staffs every shift on a shift-per-card cycle', () => {
    const shiftIds = ['morning', 'afternoon', 'night']
    const slots = makeSlots([...shiftIds, null])
    const result = suggestRotationCoverage(slots, makeCrews(4), shiftIds)

    result.coverage.forEach((day) => {
      expect(day.onDuty).toBe(3)
      expect(day.uncoveredShiftIds).toEqual([])
    })
    expect(codes(result.warnings)).not.toContain('uncovered-shift')
  })

  // The seven-week master rotation cannot reach a spread of 1 and it is not
  // the search's fault: thirty working cards across seven crews is 210
  // crew-days over a 49-day cycle, so the mean is 4.29 and *some* day has to
  // differ from *some* other. It is listed here rather than waved through by
  // a looser rule for every preset, so the invariant stays tight on the
  // fourteen that can meet it.
  const FLATNESS_EXCEPTIONS: Record<string, number> = { master_49: 2 }

  it('keeps coverage flat on every preset at its suggested crew count', () => {
    const shifts = ['s1', 's2', 's3']
    ROTATION_PRESETS.forEach((preset) => {
      const shiftIds = shifts.slice(0, preset.minShifts)
      const slots = slotsFromPreset(preset.id, shiftIds)
      const result = suggestRotationCoverage(
        slots,
        makeCrews(preset.suggestedCrews),
        shiftIds
      )
      const onDuty = result.coverage.map((day) => day.onDuty)
      const spread = Math.max(...onDuty) - Math.min(...onDuty)

      // Not every system can be perfectly flat, but none of them should swing
      // by more than one crew once the offsets are chosen properly.
      expect(
        spread,
        `${preset.label} swings by ${spread} (${onDuty.join(',')})`
      ).toBeLessThanOrEqual(FLATNESS_EXCEPTIONS[preset.id] ?? 1)
    })
  })

  it('beats naive even spacing where the pattern is not uniform', () => {
    const shiftIds = ['day', 'night']
    const slots = slotsFromPreset('dupont', shiftIds)
    expect(slots).toHaveLength(28)

    const crews = makeCrews(4)
    const suggested = suggestRotationCoverage(slots, crews, shiftIds)
    const naive = analyzeDayCoverage(
      placementsToCoverageCrews(
        slots,
        place(crews, [
          [0, 0],
          [7, 0],
          [14, 0],
          [21, 0],
        ]),
        shiftIds
      ),
      shiftIds,
      28
    )

    expect(suggested.cost).toBeLessThanOrEqual(naive.cost)
  })
})

// The reason this whole model exists: the pattern is a template for one crew,
// so the shifts it happens to name must not decide which shifts the schedule
// runs. Every case here starts from a pattern that names *only* Morning.
describe('the pattern does not decide which shifts run', () => {
  const MORNING_5_2 = [
    'morning',
    'morning',
    'morning',
    'morning',
    'morning',
    null,
    null,
  ]

  it('staffs a shift the pattern never mentions', () => {
    // Four crews on an all-Morning 5-2 week, with Night also selected. Two
    // crews cover Monday-Friday on the two shifts, two more cover the other
    // five days — 14 cells, 20 crew-days, nothing left empty. Under the old
    // model, where a crew simply took its card's shift, Night was unstaffable
    // here no matter how many crews were added.
    const shiftIds = ['morning', 'night']
    const result = suggestRotationCoverage(
      makeSlots(MORNING_5_2),
      makeCrews(4),
      shiftIds
    )

    result.coverage.forEach((day) => {
      expect(day.byShiftId.morning).toBeGreaterThanOrEqual(1)
      expect(day.byShiftId.night).toBeGreaterThanOrEqual(1)
    })
    expect(codes(result.warnings)).not.toContain('uncovered-shift')
  })

  it('puts one crew on each shift every day of a 2-2-3 with two shifts', () => {
    // The seeded "Plant Coverage (2-2-3)" roster. 4 crews x 7 working cards =
    // 28 crew-days for 14 days x 2 shifts — exactly enough, and only if two
    // crews are moved onto nights.
    const shiftIds = ['morning', 'night']
    const slots = slotsFromPreset('two_two_three', ['morning'])
    const result = suggestRotationCoverage(slots, makeCrews(4), shiftIds)

    result.coverage.forEach((day) => {
      expect(day.byShiftId.morning).toBe(1)
      expect(day.byShiftId.night).toBe(1)
    })
    expect(severities(result.warnings)).not.toContain('warning')
  })

  it('fills as many cells as the crew-days allow when it cannot fill them all', () => {
    // Two crews on the same all-Morning 5-2 week with two shifts: 10 crew-days
    // for 14 cells, so 4 must stay empty however they are placed. Filling
    // exactly 10 distinct cells is the best available, and anything that
    // double-books a cell does worse.
    const shiftIds = ['morning', 'night']
    const result = suggestRotationCoverage(
      makeSlots(MORNING_5_2),
      makeCrews(2),
      shiftIds
    )

    expect(uncoveredCells(result.coverage)).toBe(4)
  })
})

describe('unfillable gaps stay information, not instructions', () => {
  it('leaves an unavoidable gap alone rather than chasing it', () => {
    // One crew, five working cards, seven days: two days are empty whatever
    // offset it starts on. The penalty is paid by every candidate equally, so
    // it must not distort the choice — and the rest days have to stay where
    // the pattern put them.
    const slots = makeSlots([
      'morning',
      'morning',
      'morning',
      'morning',
      'morning',
      null,
      null,
    ])

    const result = suggestRotationCoverage(slots, makeCrews(1), ['morning'])

    expect(result.placements.map((p) => p.dayOffset)).toEqual([0])
    expect(result.coverage.map((day) => day.onDuty)).toEqual([
      1, 1, 1, 1, 1, 0, 0,
    ])
    // Nothing to fix, so it must not read as something to go and fix.
    expect(
      result.warnings.find((warning) => warning.code === 'coverage-gap')
    ).toMatchObject({ severity: 'info' })
  })

  it('never buys shift balance with a day nobody works', () => {
    // A 5-2 office week alternating two shifts, run by two crews. Landing them
    // on adjacent cards keeps the shift counts very even, and shuts the place
    // down on day 5. Covering the day comes first.
    const slots = makeSlots([
      'morning',
      'afternoon',
      'morning',
      'afternoon',
      'morning',
      null,
      null,
    ])

    const result = suggestRotationCoverage(slots, makeCrews(2), [
      'morning',
      'afternoon',
    ])

    expect(result.coverage.map((day) => day.onDuty)).not.toContain(0)
  })

  it('says how many crews a short-staffed rotation actually needs', () => {
    // Three crews on a three-shifts-plus-rest cycle: one crew is always off,
    // so one shift is always empty. No arrangement fixes that, so it reads as
    // info with the remedy spelled out rather than as something done wrong.
    const shiftIds = ['morning', 'afternoon', 'night']
    const result = suggestRotationCoverage(
      makeSlots([...shiftIds, null]),
      makeCrews(3),
      shiftIds
    )

    const shortfall = result.warnings.find(
      (warning) => warning.code === 'uncovered-shift'
    )
    expect(shortfall).toMatchObject({ severity: 'info' })
    expect(shortfall?.message).toContain('4 crews on this pattern would cover')
  })

  it('does not call a correct four-crew Panama roster understaffed', () => {
    // The regression that matters: 4 crews on a 14-day cycle is the textbook
    // answer, and an assumption that crews should equal cycle days flags it as
    // broken.
    const slots = slotsFromPreset('two_two_three', ['day'])
    const result = suggestRotationCoverage(slots, makeCrews(4), ['day'])
    expect(severities(result.warnings)).not.toContain('warning')
  })

  it('reports a structurally uncoverable shift as info, not a warning', () => {
    // Two crews, three shifts and a rest card: six crew-days for twelve cells,
    // so it cannot be staffed daily however the crews are placed.
    const shiftIds = ['morning', 'afternoon', 'night']
    const result = suggestRotationCoverage(
      makeSlots([...shiftIds, null]),
      makeCrews(2),
      shiftIds
    )

    const uncovered = result.warnings.filter(
      (warning) => warning.code === 'uncovered-shift'
    )
    expect(uncovered.length).toBeGreaterThan(0)
    uncovered.forEach((warning) => expect(warning.severity).toBe('info'))
    // …and it still fills every cell it possibly can: 6 crew-days, 12 cells.
    expect(uncoveredCells(result.coverage)).toBe(6)
  })
})

describe('search behaviour', () => {
  it('covers both shifts of a 28-day day/night flip with only four crews', () => {
    const shiftIds = ['day', 'night']
    const slots = slotsFromPreset('panama_day_night_flip', shiftIds)
    const result = suggestRotationCoverage(slots, makeCrews(4), shiftIds)

    result.coverage.forEach((day) => {
      expect(day.byShiftId.day).toBeGreaterThanOrEqual(1)
      expect(day.byShiftId.night).toBeGreaterThanOrEqual(1)
    })
  })

  it('is deterministic', () => {
    const shiftIds = ['day', 'swing', 'night']
    const slots = slotsFromPreset('southern_swing', shiftIds)
    const first = suggestRotationCoverage(slots, makeCrews(4), shiftIds)
    const second = suggestRotationCoverage(slots, makeCrews(4), shiftIds)
    expect(first.placements).toEqual(second.placements)
  })

  it('handles a long cycle without an exhaustive search', () => {
    // 56 cards / 6 crews is far past the exhaustive limit, so this exercises
    // the seeded local-search path.
    const cards = Array.from({ length: 56 }, (_, i) =>
      i % 8 < 4 ? 'day' : null
    )
    const result = suggestRotationCoverage(makeSlots(cards), makeCrews(6), [
      'day',
    ])

    expect(result.placements).toHaveLength(6)
    const onDuty = result.coverage.map((day) => day.onDuty)
    expect(Math.max(...onDuty) - Math.min(...onDuty)).toBeLessThanOrEqual(1)
  })

  it('never stacks two crews on one shift while another sits empty', () => {
    // With fewer crew-days than cells, every crew-day has to land on a cell of
    // its own — doubling one up buys nothing and costs a shift somewhere else.
    const shiftIds = ['morning', 'night']
    const slots = makeSlots(['morning', 'morning', 'morning', null, null])
    const result = suggestRotationCoverage(slots, makeCrews(2), shiftIds)

    result.coverage.forEach((day) => {
      shiftIds.forEach((shiftId) => {
        expect(day.byShiftId[shiftId]).toBeLessThanOrEqual(1)
      })
    })
    // 2 crews x 3 working cards = 6 of the 5 x 2 cells, so exactly 4 stay bare.
    expect(uncoveredCells(result.coverage)).toBe(4)
  })
})

describe('analyzeDayCoverage', () => {
  const shiftIds = ['morning', 'afternoon', 'night']
  const slots = makeSlots([...shiftIds, null])

  function crewsAt(pairs: [number, number][]): CoverageCrew[] {
    return placementsToCoverageCrews(
      slots,
      place(makeCrews(pairs.length), pairs),
      shiftIds
    )
  }

  it('grades a hand-made assignment rather than suggesting one', () => {
    // Everyone piled onto the same day and the same shift step.
    const analysis = analyzeDayCoverage(
      crewsAt([
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
      shiftIds,
      4
    )

    expect(analysis.coverage[0].byShiftId.morning).toBe(4)
    expect(codes(analysis.warnings)).toContain('uncovered-shift')
  })

  it('names the shift that is short when it is given labels', () => {
    const analysis = analyzeDayCoverage(crewsAt([[0, 0]]), shiftIds, 4, {
      shiftLabels: new Map([['night', 'Night']]),
    })

    expect(
      analysis.warnings.some(
        (warning) =>
          warning.code === 'uncovered-shift' &&
          warning.message.startsWith('Night has nobody on it')
      )
    ).toBe(true)
  })

  it('warns about a pattern with no rest cards', () => {
    const analysis = analyzeDayCoverage(
      placementsToCoverageCrews(
        makeSlots(['morning', 'afternoon']),
        place(makeCrews(1), [[0, 0]]),
        ['morning', 'afternoon']
      ),
      ['morning', 'afternoon'],
      2
    )
    expect(
      analysis.warnings.find((warning) => warning.code === 'long-work-run')
    ).toMatchObject({ severity: 'warning' })
  })

  it('flags a crew hand-placed on two shifts the same day', () => {
    const analysis = analyzeDayCoverage(
      [
        {
          key: 'crew-1',
          label: 'Crew 1',
          headcount: 1,
          byDay: new Map([[0, ['morning', 'night']]]),
        },
      ],
      ['morning', 'night'],
      1
    )

    expect(
      analysis.warnings.find((warning) => warning.code === 'crew-double-booked')
    ).toMatchObject({ severity: 'warning' })
  })

  it('reports an empty pattern and an empty crew list as errors', () => {
    expect(analyzeDayCoverage([], shiftIds, 0).warnings[0]).toMatchObject({
      code: 'no-positions',
      severity: 'error',
    })
    expect(analyzeDayCoverage([], shiftIds, 4).warnings[0]).toMatchObject({
      code: 'no-crews',
      severity: 'error',
    })
  })
})

describe('weekday and weekend checks', () => {
  // 2026-08-31 is a Monday — the anchor the seeded schedules use.
  const monday = new Date(2026, 7, 31)

  it('stays quiet on a Monday-anchored whole-week cycle', () => {
    const slots = slotsFromPreset('two_two_three', ['day'])
    const result = suggestRotationCoverage(slots, makeCrews(4), ['day'], {
      startDate: monday,
    })

    expect(codes(result.warnings)).not.toContain('weekday-anchor')
    expect(codes(result.warnings)).not.toContain('weekend-imbalance')
  })

  it('notes when a whole-week cycle does not start on a Monday', () => {
    const slots = slotsFromPreset('five_two', ['day'])
    const wednesday = new Date(2026, 8, 2)
    const result = suggestRotationCoverage(slots, makeCrews(1), ['day'], {
      startDate: wednesday,
    })

    expect(
      result.warnings.find((warning) => warning.code === 'weekday-anchor')
    ).toMatchObject({ severity: 'info' })
  })

  it('notes that a non-week-multiple cycle drifts across weekdays', () => {
    const slots = slotsFromPreset('four_two', ['day'])
    const result = suggestRotationCoverage(slots, makeCrews(3), ['day'], {
      startDate: monday,
    })

    expect(
      result.warnings.find((warning) => warning.code === 'weekday-drift')
    ).toMatchObject({ severity: 'info' })
  })
})

// "No quick turnaround" — the guardrail every real rotation write-up states
// and none of them can express as a list position.
describe('rest between one crew’s consecutive shifts', () => {
  // Deliberately the classic three, with the night running past midnight so
  // its end lands in the next day.
  const HOURS = new Map<string, ShiftHours>([
    ['morning', { startMinutes: 6 * 60, endMinutes: 14 * 60 }],
    ['afternoon', { startMinutes: 14 * 60, endMinutes: 22 * 60 }],
    ['night', { startMinutes: 22 * 60, endMinutes: 6 * 60 + 1440 }],
  ])

  function crewOn(shiftsByDay: (string | null)[]): CoverageCrew {
    const byDay = new Map<number, string[]>()
    shiftsByDay.forEach((shiftId, day) => {
      if (shiftId) byDay.set(day, [shiftId])
    })
    return { key: 'crew-1', label: 'Crew 1', headcount: 1, byDay }
  }

  // The reason this is measured in hours and not in list positions. Ordered
  // by start time the list is morning, afternoon, night — so night -> morning
  // steps one place *forward*, and any rule written on positions would wave
  // through the one transition it exists to catch.
  it('catches night into morning, which reads as a forward step', () => {
    const found = findQuickTurnarounds(
      [crewOn(['night', 'morning'])],
      2,
      HOURS,
      11 * 60
    )

    expect(found).toHaveLength(1)
    expect(found[0].restMinutes).toBe(0)
    expect(found[0].fromShiftId).toBe('night')
    expect(found[0].toShiftId).toBe('morning')
  })

  it('catches afternoon into morning — eight hours, the classic clopening', () => {
    const found = findQuickTurnarounds(
      [crewOn(['afternoon', 'morning'])],
      2,
      HOURS,
      11 * 60
    )
    expect(found).toHaveLength(1)
    expect(found[0].restMinutes).toBe(8 * 60)
  })

  // A rest card at the end, deliberately: on a bare three-day cycle this run
  // wraps night straight back into morning, which the seam test below covers
  // on purpose. Here the point is that the forward run itself is clean.
  it('leaves a forward rotation alone', () => {
    expect(
      findQuickTurnarounds(
        [crewOn(['morning', 'afternoon', 'night', null])],
        4,
        HOURS,
        11 * 60
      )
    ).toEqual([])
  })

  it('leaves a run of the same shift alone', () => {
    expect(
      findQuickTurnarounds(
        [crewOn(['night', 'night', 'night'])],
        3,
        HOURS,
        11 * 60
      )
    ).toEqual([])
  })

  it('does not flag across a rest day', () => {
    expect(
      findQuickTurnarounds([crewOn(['night', null, 'morning'])], 3, HOURS, 660)
    ).toEqual([])
  })

  // The cycle repeats, so the last card is followed by the first. A rotation
  // that only breaks the rule across that seam breaks it every time round.
  it('checks the seam where the cycle wraps', () => {
    const found = findQuickTurnarounds(
      [crewOn(['morning', 'night'])],
      2,
      HOURS,
      11 * 60
    )
    expect(found).toHaveLength(1)
    expect(found[0].day).toBe(1)
  })

  it('reports it as a warning that names the shifts', () => {
    const analysis = analyzeDayCoverage(
      [crewOn(['night', 'morning'])],
      ['morning', 'night'],
      2,
      {
        shiftHours: HOURS,
        shiftLabels: new Map([
          ['morning', 'Morning'],
          ['night', 'Night'],
        ]),
      }
    )

    const warning = analysis.warnings.find(
      (entry) => entry.code === 'quick-turnaround'
    )
    expect(warning?.severity).toBe('warning')
    expect(warning?.message).toContain('Night')
    expect(warning?.message).toContain('Morning')
  })

  // Without real clock times there is nothing to measure, and guessing would
  // be worse than staying quiet.
  it('says nothing at all when the caller cannot supply shift hours', () => {
    const analysis = analyzeDayCoverage(
      [crewOn(['night', 'morning'])],
      ['morning', 'night'],
      2
    )
    expect(codes(analysis.warnings)).not.toContain('quick-turnaround')
  })

  // The tie-break's whole contract: it decides between rosters that are
  // equally well covered, and never buys rest at the cost of a staffed shift.
  // Four crews, not three: three crews working three of four cards is nine
  // crew-days against twelve cells, so a hole would be arithmetic rather than
  // anything the tie-break did.
  it('never trades coverage away for a kinder rota', () => {
    const shiftIds = ['morning', 'afternoon', 'night']
    const slots = makeSlots([...shiftIds, null])
    const result = suggestRotationCoverage(slots, makeCrews(4), shiftIds, {
      shiftHours: HOURS,
    })

    expect(uncoveredCells(result.coverage)).toBe(0)
  })
})
