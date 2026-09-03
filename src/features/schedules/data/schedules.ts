import { type Schedule } from './schema'

// Two rotations, two shapes of the same idea: a cycle has one position per
// shift plus a rest slot, and one crew per position — so every crew covers
// every shift in turn and exactly one of them is off at any time.
//
// Who starts where is stated outright on each pattern entry
// (`employee_ids`/`team_ids`, set on the schedule form's "Assign to" step),
// not inferred from the shifts. The Schedule Rotation screen reads only
// this (see `features/schedule-rotation/utils.ts#getRotationRoster`), so
// there is nothing to work out about who takes the day off: whoever the
// off position names starts there, and everyone advances one position per
// period.
//
// Read them on the Schedule Rotation screen's **Weekly** tab, where one
// period is one week:
//
//   Shift Rotation — Team A, 3 shifts + rest, 4 crew, wraps every 4 weeks
//     Week 1 (from 2026-08-31)  Amir Morning   Bilal Afternoon Carla Night   Dana  Off
//     Week 2                    Amir Afternoon Bilal Night     Carla Off     Dana  Morning
//     Week 3                    Amir Night     Bilal Off       Carla Morning Dana  Afternoon
//     Week 4                    Amir Off       Bilal Morning   Carla Afternoon Dana Night
//
//   Desk Alternation — Team B, 2 shifts + rest, 3 crew, wraps every 3 weeks
//     Week 1 (from 2026-08-31)  Elias Early  Farah Late   Ghassan Off
//     Week 2                    Elias Late   Farah Off    Ghassan Early
//     Week 3                    Elias Off    Farah Early  Ghassan Late
export const defaultSchedules: Schedule[] = [
  {
    id: 'sched-rotation',
    name: 'Shift Rotation',
    description:
      'Morning → Afternoon → Night → Off, rotated weekly across four crew.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-morning', 'shift-afternoon', 'shift-night'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 4 },
    pattern: [
      {
        position: 1,
        shift_id: 'shift-morning',
        is_off: false,
        employee_ids: ['emp-a'],
      },
      {
        position: 2,
        shift_id: 'shift-afternoon',
        is_off: false,
        employee_ids: ['emp-b'],
      },
      {
        position: 3,
        shift_id: 'shift-night',
        is_off: false,
        employee_ids: ['emp-c'],
      },
      { position: 4, is_off: true, employee_ids: ['emp-d'] },
    ],
    shift_repeat: [],
    // A Monday, so the schedule's own start lines up with the start of the
    // Monday-first week the rotation screen counts periods from — period 0
    // is the week containing this date.
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },
  {
    id: 'sched-alternation',
    name: 'Desk Alternation',
    description: 'Early → Late → Off, alternated weekly across three crew.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-early', 'shift-late'],
    temporary_schedule: false,
    // "Custom alternate": the grid is sized from the shift repeats below
    // rather than from `cycle_length` (see the `custom_shifts` arm of
    // `regularScheduleSchema`'s superRefine in `data/schema.ts`).
    cycle_type: 'custom_shifts',
    cycle_length: { unit: 'custom_days', days: 3 },
    pattern: [
      {
        position: 1,
        shift_id: 'shift-early',
        is_off: false,
        employee_ids: ['emp-e'],
      },
      {
        position: 2,
        shift_id: 'shift-late',
        is_off: false,
        employee_ids: ['emp-f'],
      },
      { position: 3, is_off: true, employee_ids: ['emp-g'] },
    ],
    // The intervals are load-bearing and sum to the card count: two shifts
    // plus a rest slot needs 3 cards, and `custom_shifts` sizes the grid as
    // the plain sum of the intervals. Two shifts at interval 1 would size it
    // to 2 with no room to rest, so Early carries an allowance of 2 while the
    // pattern above spends only one of them — the schema caps a shift at no
    // *more* cards than its interval, so spending fewer is fine, and card 3
    // is left free to be the off position.
    shift_repeat: [
      { shift_id: 'shift-early', frequency: 'daily', interval: 2 },
      { shift_id: 'shift-late', frequency: 'daily', interval: 1 },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },
  // The third rotation is a different animal from the two above, and is here
  // because it is the shape most real 24/7 rosters actually take.
  //
  // Read it on the **Daily** tab — one card is one day, not one week. The
  // pattern is a pure rest mask (2 on, 2 off, 3 on, 2 off, 2 on, 3 off) and
  // every crew runs the same one; what staggers them is where each starts.
  // Four crews on a fourteen-day mask with seven working cards puts exactly
  // two people on duty every single day, with no day heavier than another.
  //
  // What the cards cannot say, and `crew_shift_id` can: two of these crews are
  // permanently on mornings and two permanently on nights. Over one cycle every
  // crew visits every card, so a shared pattern alone would rotate everyone
  // through both — fine for some rosters, wrong for this one.
  //
  // The starting positions are not arbitrary. The four crews pair up
  // differently on different days (0 with 10, 0 with 3, 3 with 7, 7 with 10),
  // so mornings and nights are only both covered if the pins alternate around
  // that cycle — hence 0 and 7 on mornings, 3 and 10 on nights. Move one crew
  // and a day loses its night cover; the "Assign to" step's coverage grid shows
  // it immediately.
  {
    id: 'sched-panama-223',
    name: 'Plant Coverage (2-2-3)',
    description:
      'Fourteen-day 2-2-3 mask, four crews, two on mornings and two on nights around the clock.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-morning', 'shift-night'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 14 },
    pattern: [
      {
        position: 1,
        shift_id: 'shift-morning',
        is_off: false,
        employee_ids: ['emp-a'],
        crew_shift_id: 'shift-morning',
      },
      { position: 2, shift_id: 'shift-morning', is_off: false },
      { position: 3, is_off: true },
      {
        position: 4,
        is_off: true,
        employee_ids: ['emp-b'],
        crew_shift_id: 'shift-night',
      },
      { position: 5, shift_id: 'shift-morning', is_off: false },
      { position: 6, shift_id: 'shift-morning', is_off: false },
      { position: 7, shift_id: 'shift-morning', is_off: false },
      {
        position: 8,
        is_off: true,
        employee_ids: ['emp-c'],
        crew_shift_id: 'shift-morning',
      },
      { position: 9, is_off: true },
      { position: 10, shift_id: 'shift-morning', is_off: false },
      {
        position: 11,
        shift_id: 'shift-morning',
        is_off: false,
        employee_ids: ['emp-d'],
        crew_shift_id: 'shift-night',
      },
      { position: 12, is_off: true },
      { position: 13, is_off: true },
      { position: 14, is_off: true },
    ],
    shift_repeat: [],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },
]
