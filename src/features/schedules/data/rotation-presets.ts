// Ready-made rotation patterns covering the shift systems that actually get
// used in the field, so a 14- or 28-day roster is a dropdown pick rather than
// twenty-eight hand-set cards.
//
// A preset is just a card list: each entry is an index into the schedule's own
// `shift_ids` (the shifts picked back on the "Shifts" step), or `null` for a
// rest card. That single shape covers both families:
//
//   - single-shift masks (5-2, 4-4, plain 2-2-3) — every work card is index 0,
//     and the rotation is purely about *which days* each crew rests;
//   - multi-shift systems (DuPont, Southern Swing, Metropolitan) — work cards
//     name different shifts, so crews rotate through days/swings/nights as
//     they advance around the cycle.
//
// Nothing here knows about crews or offsets. Who starts where is decided
// afterwards on the "Assign to" step (see `rotation-suggestion.ts`), which is
// what staggers the crews so they are not all resting on the same day.

const on = (count: number, shift = 0): (number | null)[] =>
  Array.from({ length: count }, () => shift)

const off = (count: number): (number | null)[] =>
  Array.from({ length: count }, () => null)

export const ROTATION_PRESET_GROUPS = [
  'Office & simple',
  'Continuous coverage',
  'Named systems',
] as const

export type RotationPresetGroup = (typeof ROTATION_PRESET_GROUPS)[number]

export type RotationPreset = {
  id: string
  label: string
  group: RotationPresetGroup
  description: string
  // How many distinct shifts the pattern actually names. A preset is offered
  // only once the schedule has at least this many shifts selected.
  minShifts: number
  // The crew count this system is designed around — shown as a hint on the
  // "Assign to" step, never enforced.
  suggestedCrews: number
  // Built from the shift count so the one dynamic preset (one card per shift
  // plus a rest slot) can size itself; every other preset ignores the argument.
  buildCards: (shiftCount: number) => (number | null)[]
}

export const ROTATION_PRESETS: RotationPreset[] = [
  // --- Office & simple: whole-week cycles, usually one crew, one shift ---
  {
    id: 'five_two',
    label: '5 on / 2 off',
    group: 'Office & simple',
    description:
      'The standard working week. Start the schedule on a Monday and the two rest cards land on the weekend.',
    minShifts: 1,
    suggestedCrews: 1,
    buildCards: () => [...on(5), ...off(2)],
  },
  {
    id: 'four_three',
    label: '4 on / 3 off',
    group: 'Office & simple',
    description:
      'Compressed week — four longer days, three off. Still a whole week, so weekdays stay put.',
    minShifts: 1,
    suggestedCrews: 1,
    buildCards: () => [...on(4), ...off(3)],
  },
  {
    id: 'six_two',
    label: '6 on / 2 off',
    group: 'Office & simple',
    description:
      'Eight-day cycle, so rest days walk through the week rather than sitting on a fixed weekend.',
    minShifts: 1,
    suggestedCrews: 1,
    buildCards: () => [...on(6), ...off(2)],
  },

  // --- Continuous coverage: short cycles, several crews, round-the-clock ---
  {
    id: 'four_two',
    label: '4 on / 2 off',
    group: 'Continuous coverage',
    description:
      'Six-day cycle. With three crews staggered two days apart, someone is always on.',
    minShifts: 1,
    suggestedCrews: 3,
    buildCards: () => [...on(4), ...off(2)],
  },
  {
    id: 'three_three',
    label: '3 on / 3 off',
    group: 'Continuous coverage',
    description: 'Six-day cycle, two crews in exact opposition.',
    minShifts: 1,
    suggestedCrews: 2,
    buildCards: () => [...on(3), ...off(3)],
  },
  {
    id: 'four_four',
    label: '4 on / 4 off',
    group: 'Continuous coverage',
    description:
      'Eight-day cycle, two crews opposed — the usual twelve-hour offshore and plant roster.',
    minShifts: 1,
    suggestedCrews: 2,
    buildCards: () => [...on(4), ...off(4)],
  },
  {
    id: 'ddnnoo',
    label: '2 days / 2 nights / 2 off (DDNNOO)',
    group: 'Continuous coverage',
    description:
      'Six-day cycle rotating days then nights. Three crews cover it end to end.',
    minShifts: 2,
    suggestedCrews: 3,
    buildCards: () => [...on(2, 0), ...on(2, 1), ...off(2)],
  },
  {
    id: 'metropolitan',
    label: 'Metropolitan (2-2-4)',
    group: 'Continuous coverage',
    description:
      'Two days, two nights, four off across an eight-day cycle. Four crews.',
    minShifts: 2,
    suggestedCrews: 4,
    buildCards: () => [...on(2, 0), ...on(2, 1), ...off(4)],
  },
  {
    id: 'per_shift_plus_rest',
    label: 'One card per shift + rest',
    group: 'Continuous coverage',
    description:
      'The simplest full rotation: one cycle position per selected shift plus a rest slot, so every crew works every shift in turn.',
    minShifts: 2,
    suggestedCrews: 3,
    buildCards: (shiftCount) => [
      ...Array.from({ length: Math.max(shiftCount, 1) }, (_, i) => i),
      null,
    ],
  },

  // --- Named systems: the 14- and 28-day rosters people ask for by name ---
  {
    id: 'two_two_three',
    label: '2-2-3 Continental (Panama)',
    group: 'Named systems',
    description:
      'Fourteen-day cycle: 2 on, 2 off, 3 on, 2 off, 2 on, 3 off. Four crews give flat round-the-clock coverage and every second weekend off.',
    minShifts: 1,
    suggestedCrews: 4,
    buildCards: () => [
      ...on(2),
      ...off(2),
      ...on(3),
      ...off(2),
      ...on(2),
      ...off(3),
    ],
  },
  {
    id: 'pitman',
    label: 'Pitman (2-3-2)',
    group: 'Named systems',
    description:
      'The 2-2-3 family phased differently: 2 on, 3 off, 2 on, 2 off, 3 on, 2 off. Every crew gets a full weekend off every other week.',
    minShifts: 1,
    suggestedCrews: 4,
    buildCards: () => [
      ...on(2),
      ...off(3),
      ...on(2),
      ...off(2),
      ...on(3),
      ...off(2),
    ],
  },
  {
    id: 'panama_day_night_flip',
    label: '2-2-3 with 28-day day/night flip',
    group: 'Named systems',
    description:
      'The 2-2-3 mask run twice: the first fourteen days on shift 1, the next fourteen on shift 2, so crews swap day for night once a month.',
    minShifts: 2,
    suggestedCrews: 4,
    buildCards: () => [
      // First half — every working card on the first selected shift.
      ...on(2, 0),
      ...off(2),
      ...on(3, 0),
      ...off(2),
      ...on(2, 0),
      ...off(3),
      // Second half — the identical rest mask, flipped to the second shift.
      ...on(2, 1),
      ...off(2),
      ...on(3, 1),
      ...off(2),
      ...on(2, 1),
      ...off(3),
    ],
  },
  {
    id: 'dupont',
    label: 'DuPont',
    group: 'Named systems',
    description:
      'Twenty-eight days: 4 nights, 3 off, 3 days, 1 off, 3 nights, 3 off, 4 days, then a full seven off. Four crews.',
    minShifts: 2,
    suggestedCrews: 4,
    buildCards: () => [
      ...on(4, 1),
      ...off(3),
      ...on(3, 0),
      ...off(1),
      ...on(3, 1),
      ...off(3),
      ...on(4, 0),
      ...off(7),
    ],
  },
  {
    id: 'southern_swing',
    label: 'Southern Swing',
    group: 'Named systems',
    description:
      'Twenty-eight days in three blocks of seven — days, then swings, then nights — with two or three off between each. Needs three shifts.',
    minShifts: 3,
    suggestedCrews: 4,
    buildCards: () => [
      ...on(7, 0),
      ...off(2),
      ...on(7, 1),
      ...off(2),
      ...on(7, 2),
      ...off(3),
    ],
  },
]

export function getRotationPreset(id: string): RotationPreset | undefined {
  return ROTATION_PRESETS.find((preset) => preset.id === id)
}
