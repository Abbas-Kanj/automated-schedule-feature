import { describe, expect, it } from 'vitest'
import { ROTATION_PRESETS, getRotationPreset } from './data/rotation-presets'
import {
  type SuggestionCrew,
  type SuggestionSlot,
  crewRequirement,
  suggestRotationCoverage,
} from './rotation-suggestion'

// Every worked example printed in `docs/ROTATION_ALGORITHM.md` is computed
// here, so the doc can't drift from what the code does — a failure here means
// the doc is now wrong.

function slots(cards: (string | null)[]): SuggestionSlot[] {
  return cards.map((shiftId, index) => ({
    index,
    shiftId: shiftId ?? undefined,
    isOff: shiftId === null,
  }))
}

function crews(count: number): SuggestionCrew[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `crew-${i + 1}`,
    kind: 'team' as const,
    label: `Crew ${i + 1}`,
    employeeIds: [`emp-${i + 1}`],
  }))
}

function fromPreset(id: string, shiftIds: string[]): SuggestionSlot[] {
  const preset = getRotationPreset(id)
  if (!preset) throw new Error(`unknown preset ${id}`)
  return slots(
    preset
      .buildCards(shiftIds.length)
      .map((c) => (c === null ? null : shiftIds[c]))
  )
}

function uncovered(coverage: { uncoveredShiftIds: string[] }[]): number {
  return coverage.reduce((sum, day) => sum + day.uncoveredShiftIds.length, 0)
}

describe('doc: "Sizing the crew pool"', () => {
  it('a 5-2 over two shifts needs four crews, not the three the division gives', () => {
    const shiftIds = ['morning', 'night']
    const pattern = fromPreset('five_two', ['morning'])
    const requirement = crewRequirement(pattern, shiftIds)

    expect(requirement.workDaysPerCrew).toBe(5)
    expect(requirement.cellsPerCycle).toBe(14)
    expect(requirement.crewDayBound).toBe(3)
    expect(requirement.minimumCrews).toBe(4)
    expect(requirement.exact).toBe(true)
  })

  it('four crews on that 5-2 really do cover every cell', () => {
    const shiftIds = ['morning', 'night']
    const pattern = fromPreset('five_two', ['morning'])
    const result = suggestRotationCoverage(pattern, crews(4), shiftIds)
    expect(uncovered(result.coverage)).toBe(0)
  })

  it('three crews leave cells short, and it is reported as structural', () => {
    const shiftIds = ['morning', 'night']
    const pattern = fromPreset('five_two', ['morning'])
    const result = suggestRotationCoverage(pattern, crews(3), shiftIds, {
      minimumCrews: 4,
    })

    // Two cells, not the one the crew-day arithmetic suggests: every crew
    // walks the same cards, so crews on duty together can land on the same
    // shift.
    expect(uncovered(result.coverage)).toBe(2)
    const shortfall = result.warnings.filter(
      (w) => w.code === 'uncovered-shift' || w.code === 'coverage-gap'
    )
    expect(shortfall.length).toBeGreaterThan(0)
    // Below the requirement no assignment can help, so it must not read as a
    // mistake to go and fix.
    shortfall.forEach((w) => expect(w.severity).toBe('info'))
  })
})

describe('doc: "The pattern does not decide which shifts run"', () => {
  // The case the shift-step degree of freedom exists for: every card says
  // Morning, and Night still gets staffed.
  it('staffs Night off an all-Morning 5-2 pattern', () => {
    const shiftIds = ['morning', 'night']
    const pattern = fromPreset('five_two', ['morning'])
    const result = suggestRotationCoverage(pattern, crews(4), shiftIds)

    result.coverage.forEach((day) => {
      expect(day.byShiftId['morning']).toBeGreaterThanOrEqual(1)
      expect(day.byShiftId['night']).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('doc: the preset coverage table', () => {
  // One row per preset, exactly as printed in the doc's "Preset coverage"
  // section. A preset added to the library without a row here fails.
  const TABLE: Record<
    string,
    { crewsNeeded: number; uncoveredAtSuggested: number }
  > = {
    five_two: { crewsNeeded: 2, uncoveredAtSuggested: 2 },
    four_three: { crewsNeeded: 2, uncoveredAtSuggested: 3 },
    six_two: { crewsNeeded: 2, uncoveredAtSuggested: 2 },
    four_two: { crewsNeeded: 2, uncoveredAtSuggested: 0 },
    three_three: { crewsNeeded: 2, uncoveredAtSuggested: 0 },
    four_four: { crewsNeeded: 2, uncoveredAtSuggested: 0 },
    ddnnoo: { crewsNeeded: 3, uncoveredAtSuggested: 0 },
    metropolitan: { crewsNeeded: 4, uncoveredAtSuggested: 0 },
    per_shift_plus_rest: { crewsNeeded: 3, uncoveredAtSuggested: 0 },
    two_two_three: { crewsNeeded: 2, uncoveredAtSuggested: 0 },
    pitman: { crewsNeeded: 2, uncoveredAtSuggested: 0 },
    panama_day_night_flip: { crewsNeeded: 4, uncoveredAtSuggested: 0 },
    dupont: { crewsNeeded: 4, uncoveredAtSuggested: 0 },
    weekly_forward_28: { crewsNeeded: 4, uncoveredAtSuggested: 0 },
    southern_swing: { crewsNeeded: 4, uncoveredAtSuggested: 0 },
    master_49: { crewsNeeded: 6, uncoveredAtSuggested: 0 },
    // The one the doc calls out: four crews bring 76 crew-days to 84 cells.
    healthcare_five_two: { crewsNeeded: 7, uncoveredAtSuggested: 16 },
  }

  const shiftIds = ['s1', 's2', 's3']

  it('lists exactly the presets the library ships', () => {
    expect(ROTATION_PRESETS.map((preset) => preset.id).sort()).toEqual(
      Object.keys(TABLE).sort()
    )
    // The doc says "the 17 ready-made patterns".
    expect(ROTATION_PRESETS).toHaveLength(17)
  })

  ROTATION_PRESETS.forEach((preset) => {
    it(`${preset.id} matches its row`, () => {
      const shifts = shiftIds.slice(0, preset.minShifts)
      const pattern = fromPreset(preset.id, shifts)
      const row = TABLE[preset.id]

      expect(
        crewRequirement(pattern, shifts).minimumCrews,
        'crews needed'
      ).toBe(row.crewsNeeded)
      expect(
        uncovered(
          suggestRotationCoverage(pattern, crews(preset.suggestedCrews), shifts)
            .coverage
        ),
        'uncovered cells at the suggested crew count'
      ).toBe(row.uncoveredAtSuggested)
    })
  })

  // master_49's 4.29 mean puts a spread of ≤1 out of reach.
  it('is flat at the suggested crew count except the 49-day master rotation', () => {
    ROTATION_PRESETS.forEach((preset) => {
      if (TABLE[preset.id].uncoveredAtSuggested > 0) return
      const shifts = shiftIds.slice(0, preset.minShifts)
      const onDuty = suggestRotationCoverage(
        fromPreset(preset.id, shifts),
        crews(preset.suggestedCrews),
        shifts
      ).coverage.map((day) => day.onDuty)
      const spread = Math.max(...onDuty) - Math.min(...onDuty)
      expect(spread, preset.id).toBeLessThanOrEqual(
        preset.id === 'master_49' ? 2 : 0
      )
    })
  })
})

describe('doc: "An office week is not understaffed"', () => {
  it('reports the weekend as information, not as a warning', () => {
    const shiftIds = ['morning']
    const pattern = fromPreset('five_two', shiftIds)
    const requirement = crewRequirement(pattern, shiftIds)
    expect(requirement.minimumCrews).toBe(2)

    const result = suggestRotationCoverage(pattern, crews(1), shiftIds, {
      minimumCrews: requirement.minimumCrews,
    })
    const gap = result.warnings.find((w) => w.code === 'coverage-gap')
    expect(gap?.severity).toBe('info')
  })
})
