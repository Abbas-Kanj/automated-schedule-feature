import { describe, expect, it } from 'vitest'
import {
  ROTATION_PRESET_GROUPS,
  ROTATION_PRESETS,
  getRotationPreset,
} from './rotation-presets'

// `minShifts`/`suggestedCrews` are trusted, not checked at runtime, so a
// preset naming an undeclared shift would silently build a pattern pointing
// at `undefined`. Roster quality is covered in `rotation-suggestion.test.ts`;
// this is about the data being well formed.

function cardsFor(preset: (typeof ROTATION_PRESETS)[number]) {
  return preset.buildCards(preset.minShifts)
}

describe('every rotation preset', () => {
  it('has a unique id that getRotationPreset can find', () => {
    const ids = ROTATION_PRESETS.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id) => {
      expect(getRotationPreset(id)?.id).toBe(id)
    })
  })

  it('belongs to one of the declared groups', () => {
    ROTATION_PRESETS.forEach((preset) => {
      expect(ROTATION_PRESET_GROUPS).toContain(preset.group)
    })
  })

  it('is labelled and described', () => {
    ROTATION_PRESETS.forEach((preset) => {
      expect(preset.label.trim(), preset.id).not.toBe('')
      expect(preset.description.trim(), preset.id).not.toBe('')
    })
  })

  it('builds a non-empty cycle with at least one working card', () => {
    ROTATION_PRESETS.forEach((preset) => {
      const cards = cardsFor(preset)
      expect(cards.length, preset.id).toBeGreaterThan(0)
      expect(
        cards.some((card) => card !== null),
        `${preset.id} is all rest cards`
      ).toBe(true)
    })
  })

  // A preset offered at `minShifts` shifts must not name a shift beyond that.
  it('never names a shift beyond its own minShifts', () => {
    ROTATION_PRESETS.forEach((preset) => {
      expect(preset.minShifts, preset.id).toBeGreaterThanOrEqual(1)
      cardsFor(preset).forEach((card) => {
        if (card === null) return
        expect(card, `${preset.id} names shift index ${card}`).toBeLessThan(
          preset.minShifts
        )
        expect(card).toBeGreaterThanOrEqual(0)
      })
    })
  })

  // Otherwise a higher `minShifts` gates it out of the picker for no reason.
  it('uses every shift it demands', () => {
    ROTATION_PRESETS.forEach((preset) => {
      const named = new Set(
        cardsFor(preset).filter((card): card is number => card !== null)
      )
      expect(named.size, `${preset.id} declares ${preset.minShifts}`).toBe(
        preset.minShifts
      )
    })
  })

  it('suggests at least one crew', () => {
    ROTATION_PRESETS.forEach((preset) => {
      expect(preset.suggestedCrews, preset.id).toBeGreaterThanOrEqual(1)
    })
  })

  // Every preset but `per_shift_plus_rest` ignores shift count entirely.
  it('is stable across shift counts unless it is meant to size itself', () => {
    ROTATION_PRESETS.forEach((preset) => {
      const atMin = preset.buildCards(preset.minShifts)
      const atMore = preset.buildCards(preset.minShifts + 2)
      if (preset.id === 'per_shift_plus_rest') {
        expect(atMore.length).toBe(atMin.length + 2)
        return
      }
      expect(atMore, preset.id).toEqual(atMin)
    })
  })
})

describe('per_shift_plus_rest', () => {
  it('is one card per shift plus a single rest card', () => {
    const preset = getRotationPreset('per_shift_plus_rest')
    expect(preset?.buildCards(3)).toEqual([0, 1, 2, null])
  })

  // A degenerate call still has to produce a usable cycle rather than a lone
  // rest card, since the picker can ask before any shift is selected.
  it('still builds a working card when asked for no shifts', () => {
    expect(getRotationPreset('per_shift_plus_rest')?.buildCards(0)).toEqual([
      0,
      null,
    ])
  })
})

describe('the named systems have the cycle lengths they are named for', () => {
  // `per_shift_plus_rest` is the one preset whose length depends on the
  // schedule's shift count, so it is checked in its own block above.
  const EXPECTED_LENGTHS: Record<string, number> = {
    five_two: 7,
    four_three: 7,
    six_two: 8,
    four_two: 6,
    three_three: 6,
    four_four: 8,
    ddnnoo: 6,
    metropolitan: 8,
    two_two_three: 14,
    pitman: 14,
    panama_day_night_flip: 28,
    dupont: 28,
    weekly_forward_28: 28,
    master_49: 49,
    healthcare_five_two: 28,
    southern_swing: 28,
  }

  const fixedLengthPresets = ROTATION_PRESETS.filter(
    (preset) => preset.id !== 'per_shift_plus_rest'
  )

  it('matches every fixed-length preset in the library', () => {
    fixedLengthPresets.forEach((preset) => {
      expect(cardsFor(preset).length, preset.id).toBe(
        EXPECTED_LENGTHS[preset.id]
      )
    })
  })

  // Keeps this table honest: a preset added to the library without a length
  // here fails rather than going unchecked.
  it('names every fixed-length preset, so a new one has to be added here', () => {
    expect(fixedLengthPresets.map((preset) => preset.id).sort()).toEqual(
      Object.keys(EXPECTED_LENGTHS).sort()
    )
  })
})
