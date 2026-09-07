import { type Schedule } from './schema'

// The three original rotations exist to show the same thing from different
// angles: **the pattern is a template, `day_coverage` is the roster.**
//
// The block that follows them (`sched-security-*`, `sched-factory-*`,
// `sched-hospital-*`, `sched-office-*`) is a wider sample: the named
// round-the-clock systems a real security firm, factory or hospital runs —
// DuPont, 2-2-3 Pitman, Continental, Southern Swing — plus one plain fixed
// Monday–Friday office schedule. Every rotation's `pattern` is one crew's
// journey and every `day_coverage` below is exactly what pressing "Suggest
// assignment" produces from it (all cover every selected shift every day,
// no gaps).
//
// A pattern card says what one crew does on that step of the cycle — "Morning,
// Morning, off, Afternoon". It does not say how many shifts run that day. What
// runs is `shift_ids`, and the schedule is meant to cover every one of them
// every day; `day_coverage` records who actually does, as a (cycle day ×
// shift) → crews matrix. The Schedule Rotation screen reads only that matrix
// (see `features/schedule-rotation/utils.ts#getRotationRoster`), so there is
// nothing to work out about who takes the day off — whoever no cell names on a
// day is off that day.
//
// Each matrix below was produced by the "Assign to" step's own suggestion
// (`schedules/rotation-suggestion.ts`) from the pattern above it, so they are
// exactly what a user pressing "Suggest assignment" would get.
//
// Read the first two on the Schedule Rotation screen's **Weekly** tab, where
// one period is one week:
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
      { position: 1, shift_id: 'shift-morning', is_off: false },
      { position: 2, shift_id: 'shift-afternoon', is_off: false },
      { position: 3, shift_id: 'shift-night', is_off: false },
      { position: 4, is_off: true },
    ],
    shift_repeat: [],
    // Four crews on a four-card cycle, staggered one card apart: every shift
    // is covered every day and exactly one crew is resting.
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 0,
        shift_id: 'shift-afternoon',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 0,
        shift_id: 'shift-night',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-morning',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-afternoon',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-afternoon',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-night',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-morning',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-afternoon',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
    ],
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
      { position: 1, shift_id: 'shift-early', is_off: false },
      { position: 2, shift_id: 'shift-late', is_off: false },
      { position: 3, is_off: true },
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
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-early',
        employee_ids: ['emp-e'],
        team_ids: [],
      },
      { day: 0, shift_id: 'shift-late', employee_ids: ['emp-f'], team_ids: [] },
      {
        day: 1,
        shift_id: 'shift-early',
        employee_ids: ['emp-g'],
        team_ids: [],
      },
      { day: 1, shift_id: 'shift-late', employee_ids: ['emp-e'], team_ids: [] },
      {
        day: 2,
        shift_id: 'shift-early',
        employee_ids: ['emp-f'],
        team_ids: [],
      },
      { day: 2, shift_id: 'shift-late', employee_ids: ['emp-g'], team_ids: [] },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },
  // The third rotation is a different animal from the two above, and is here
  // because it is the shape most real 24/7 rosters actually take.
  //
  // Read it on the **Daily** tab — one card is one day, not one week. The
  // pattern is a pure rest mask (2 on, 2 off, 3 on, 2 off, 2 on, 3 off) and
  // every crew runs the same one; what staggers them is where each starts and
  // which shift it is moved onto. Four crews on a fourteen-day mask with seven
  // working cards puts exactly two people on duty every single day.
  //
  // Note what the *pattern* says here and what the matrix does with it: every
  // working card names Morning, and Night is still staffed on all fourteen
  // days. That is the whole point of the rework — the pattern supplies the
  // rhythm, `shift_ids` supplies what has to run, and the suggestion moves two
  // of the four crews onto nights to reconcile the two. Under the old model,
  // where a crew simply took its card's shift, this roster was impossible to
  // express without pinning each crew by hand.
  //
  // Amir and Carla hold mornings, Bilal and Dana nights, and the four never
  // collide because their starting days interleave (0 and 7 on mornings, 3 and
  // 10 on nights). Move one and a day loses its cover; the "Assign to" step's
  // coverage grid shows it immediately.
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
      { position: 1, shift_id: 'shift-morning', is_off: false },
      { position: 2, shift_id: 'shift-morning', is_off: false },
      { position: 3, is_off: true },
      { position: 4, is_off: true },
      { position: 5, shift_id: 'shift-morning', is_off: false },
      { position: 6, shift_id: 'shift-morning', is_off: false },
      { position: 7, shift_id: 'shift-morning', is_off: false },
      { position: 8, is_off: true },
      { position: 9, is_off: true },
      { position: 10, shift_id: 'shift-morning', is_off: false },
      { position: 11, shift_id: 'shift-morning', is_off: false },
      { position: 12, is_off: true },
      { position: 13, is_off: true },
      { position: 14, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 0,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 4,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 4,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 5,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 5,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 6,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 6,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 7,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 7,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 8,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 8,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 9,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 9,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 10,
        shift_id: 'shift-morning',
        employee_ids: ['emp-a'],
        team_ids: [],
      },
      {
        day: 10,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
      {
        day: 11,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 11,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 12,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 12,
        shift_id: 'shift-night',
        employee_ids: ['emp-b'],
        team_ids: [],
      },
      {
        day: 13,
        shift_id: 'shift-morning',
        employee_ids: ['emp-c'],
        team_ids: [],
      },
      {
        day: 13,
        shift_id: 'shift-night',
        employee_ids: ['emp-d'],
        team_ids: [],
      },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },

  // ===================================================================
  // Wider sample: the named 24/7 systems, plus one fixed office week.
  // Read the rotations on the Schedule Rotation screen's **Daily** tab —
  // every cycle below is measured in days, not weeks.
  // ===================================================================

  // Security — DuPont. One four-crew guard force on 12-hour watches: each
  // crew does 4 nights, 3 off, 3 days, 1 off, 3 nights, 3 off, 4 days, then
  // 7 off — a 28-day cycle. Two shifts run every day (one day watch, one
  // night); the suggestion staggers the four crews 7 days apart so exactly
  // two are on each day, one on each watch. 4 crews × 14 working cards = 56
  // crew-days for 28 days × 2 shifts — exactly filled.
  {
    id: 'sched-security-dupont',
    name: 'Security — 24/7 Guard (DuPont)',
    description:
      '28-day DuPont rotation — four guard crews, 12-hour day and night watches around the clock.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-day-12', 'shift-night-12'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 28 },
    pattern: [
      { position: 1, shift_id: 'shift-night-12', is_off: false },
      { position: 2, shift_id: 'shift-night-12', is_off: false },
      { position: 3, shift_id: 'shift-night-12', is_off: false },
      { position: 4, shift_id: 'shift-night-12', is_off: false },
      { position: 5, is_off: true },
      { position: 6, is_off: true },
      { position: 7, is_off: true },
      { position: 8, shift_id: 'shift-day-12', is_off: false },
      { position: 9, shift_id: 'shift-day-12', is_off: false },
      { position: 10, shift_id: 'shift-day-12', is_off: false },
      { position: 11, is_off: true },
      { position: 12, shift_id: 'shift-night-12', is_off: false },
      { position: 13, shift_id: 'shift-night-12', is_off: false },
      { position: 14, shift_id: 'shift-night-12', is_off: false },
      { position: 15, is_off: true },
      { position: 16, is_off: true },
      { position: 17, is_off: true },
      { position: 18, shift_id: 'shift-day-12', is_off: false },
      { position: 19, shift_id: 'shift-day-12', is_off: false },
      { position: 20, shift_id: 'shift-day-12', is_off: false },
      { position: 21, shift_id: 'shift-day-12', is_off: false },
      { position: 22, is_off: true },
      { position: 23, is_off: true },
      { position: 24, is_off: true },
      { position: 25, is_off: true },
      { position: 26, is_off: true },
      { position: 27, is_off: true },
      { position: 28, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 0,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 1,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 1,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 2,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 2,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 3,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 3,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 4,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 4,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 5,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 5,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 6,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 6,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 7,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 7,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 8,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 8,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 9,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 9,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 10,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 10,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 11,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 11,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 12,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 12,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 13,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 13,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 14,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 14,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 15,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 15,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 16,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 16,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 17,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 17,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 18,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 18,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 19,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 19,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 20,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 20,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 21,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 21,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 22,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 22,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 23,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 23,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 24,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 24,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 25,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 25,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 26,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 26,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 27,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 27,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },

  // Security — 2-2-3 (Pitman). The same four guard crews on a shorter,
  // fixed-weekday 14-day cycle: 2 on, 2 off, 3 on, 2 off, 2 on, 3 off.
  // Every crew works exactly 7 of 14 days; two shifts run daily. Notice the
  // pattern names only the day watch on every working card — the suggestion
  // transposes two of the four crews onto nights (shift step 1) to cover
  // both. 4 × 7 = 28 crew-days = 14 days × 2 shifts.
  {
    id: 'sched-security-223',
    name: 'Security — Guard Roster (2-2-3)',
    description:
      '14-day 2-2-3 Pitman roster — four guard crews, every crew a fixed set of weekdays, 12-hour watches.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-day-12', 'shift-night-12'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 14 },
    pattern: [
      { position: 1, shift_id: 'shift-day-12', is_off: false },
      { position: 2, shift_id: 'shift-day-12', is_off: false },
      { position: 3, is_off: true },
      { position: 4, is_off: true },
      { position: 5, shift_id: 'shift-day-12', is_off: false },
      { position: 6, shift_id: 'shift-day-12', is_off: false },
      { position: 7, shift_id: 'shift-day-12', is_off: false },
      { position: 8, is_off: true },
      { position: 9, is_off: true },
      { position: 10, shift_id: 'shift-day-12', is_off: false },
      { position: 11, shift_id: 'shift-day-12', is_off: false },
      { position: 12, is_off: true },
      { position: 13, is_off: true },
      { position: 14, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 0,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 1,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 1,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 2,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 2,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 3,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 3,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 4,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 4,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 5,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 5,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 6,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 6,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 7,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 7,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 8,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 8,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 9,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 9,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 10,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-alpha'],
      },
      {
        day: 10,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
      {
        day: 11,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 11,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 12,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 12,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-bravo'],
      },
      {
        day: 13,
        shift_id: 'shift-day-12',
        employee_ids: [],
        team_ids: ['team-sec-charlie'],
      },
      {
        day: 13,
        shift_id: 'shift-night-12',
        employee_ids: [],
        team_ids: ['team-sec-delta'],
      },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },

  // Factory — Continental. The classic short continuous-line cycle: 2
  // mornings, 2 afternoons, 2 nights, 2 off — 8 days. Four crews staggered
  // 2 days apart put one crew on each of the three 8-hour shifts every day,
  // with one crew resting. (An 8-day cycle is not a whole number of weeks,
  // so each crew's weekdays drift — normal for continuous operations, shown
  // as an info note on the coverage panel.)
  {
    id: 'sched-factory-continental',
    name: 'Factory — Continuous Line (Continental)',
    description:
      '8-day Continental rotation — four line crews through Morning, Afternoon and Night, one resting.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-morning', 'shift-afternoon', 'shift-night'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 8 },
    pattern: [
      { position: 1, shift_id: 'shift-morning', is_off: false },
      { position: 2, shift_id: 'shift-morning', is_off: false },
      { position: 3, shift_id: 'shift-afternoon', is_off: false },
      { position: 4, shift_id: 'shift-afternoon', is_off: false },
      { position: 5, shift_id: 'shift-night', is_off: false },
      { position: 6, shift_id: 'shift-night', is_off: false },
      { position: 7, is_off: true },
      { position: 8, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 0,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 0,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 1,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 1,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 1,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 2,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 2,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 2,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 3,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 3,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 3,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 4,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 4,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 4,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 5,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 5,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 5,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 6,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 6,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 6,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 7,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 7,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 7,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },

  // Factory — Southern Swing. The long slow-rotating version: a crew spends
  // a full week on mornings, 2 off, a week of afternoons, 2 off, a week of
  // nights, 3 off — 28 days. Four crews 7 days apart cover all three shifts
  // every day. Same line, same people as Continental above; this is the
  // roster when the plant wants fewer shift changes per person.
  {
    id: 'sched-factory-swing',
    name: 'Factory — Continuous Line (Southern Swing)',
    description:
      '28-day Southern Swing rotation — four line crews, a week on each shift before rotating.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-morning', 'shift-afternoon', 'shift-night'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 28 },
    pattern: [
      { position: 1, shift_id: 'shift-morning', is_off: false },
      { position: 2, shift_id: 'shift-morning', is_off: false },
      { position: 3, shift_id: 'shift-morning', is_off: false },
      { position: 4, shift_id: 'shift-morning', is_off: false },
      { position: 5, shift_id: 'shift-morning', is_off: false },
      { position: 6, shift_id: 'shift-morning', is_off: false },
      { position: 7, shift_id: 'shift-morning', is_off: false },
      { position: 8, is_off: true },
      { position: 9, is_off: true },
      { position: 10, shift_id: 'shift-afternoon', is_off: false },
      { position: 11, shift_id: 'shift-afternoon', is_off: false },
      { position: 12, shift_id: 'shift-afternoon', is_off: false },
      { position: 13, shift_id: 'shift-afternoon', is_off: false },
      { position: 14, shift_id: 'shift-afternoon', is_off: false },
      { position: 15, shift_id: 'shift-afternoon', is_off: false },
      { position: 16, shift_id: 'shift-afternoon', is_off: false },
      { position: 17, is_off: true },
      { position: 18, is_off: true },
      { position: 19, shift_id: 'shift-night', is_off: false },
      { position: 20, shift_id: 'shift-night', is_off: false },
      { position: 21, shift_id: 'shift-night', is_off: false },
      { position: 22, shift_id: 'shift-night', is_off: false },
      { position: 23, shift_id: 'shift-night', is_off: false },
      { position: 24, shift_id: 'shift-night', is_off: false },
      { position: 25, shift_id: 'shift-night', is_off: false },
      { position: 26, is_off: true },
      { position: 27, is_off: true },
      { position: 28, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 0,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 0,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 1,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 1,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 1,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 2,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 2,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 2,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 3,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 3,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 3,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 4,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 4,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 4,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 5,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 5,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 5,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 6,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 6,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 6,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 7,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 7,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 7,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 8,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 8,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 8,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 9,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 9,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 9,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 10,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 10,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 10,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 11,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 11,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 11,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 12,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 12,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 12,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 13,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 13,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 13,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 14,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 14,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 14,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 15,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 15,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 15,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 16,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 16,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 16,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 17,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 17,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 17,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 18,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 18,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 18,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 19,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 19,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 19,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 20,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 20,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 20,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 21,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 21,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 21,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 22,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 22,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 22,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 23,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 23,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 23,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 24,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 24,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 24,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-blue'],
      },
      {
        day: 25,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 25,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 25,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 26,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 26,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 26,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
      {
        day: 27,
        shift_id: 'shift-afternoon',
        employee_ids: [],
        team_ids: ['team-fac-red'],
      },
      {
        day: 27,
        shift_id: 'shift-morning',
        employee_ids: [],
        team_ids: ['team-fac-gold'],
      },
      {
        day: 27,
        shift_id: 'shift-night',
        employee_ids: [],
        team_ids: ['team-fac-green'],
      },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },

  // Hospital — Ward Nursing (Pitman 12h). Same 2-2-3 shape as the guard
  // roster, but the crews are four individually-picked nurses rather than
  // teams — the common case on a ward, where the rotation is built from
  // named people, not standing crews. Two nurses hold days, two hold
  // nights, so the ward always has one of each on the floor.
  {
    id: 'sched-hospital-pitman',
    name: 'Hospital — Ward Nursing (Pitman 12h)',
    description:
      '14-day 2-2-3 Pitman roster for four ward nurses — two on 12-hour days, two on nights.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-day-12', 'shift-night-12'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 14 },
    pattern: [
      { position: 1, shift_id: 'shift-day-12', is_off: false },
      { position: 2, shift_id: 'shift-day-12', is_off: false },
      { position: 3, is_off: true },
      { position: 4, is_off: true },
      { position: 5, shift_id: 'shift-day-12', is_off: false },
      { position: 6, shift_id: 'shift-day-12', is_off: false },
      { position: 7, shift_id: 'shift-day-12', is_off: false },
      { position: 8, is_off: true },
      { position: 9, is_off: true },
      { position: 10, shift_id: 'shift-day-12', is_off: false },
      { position: 11, shift_id: 'shift-day-12', is_off: false },
      { position: 12, is_off: true },
      { position: 13, is_off: true },
      { position: 14, is_off: true },
    ],
    shift_repeat: [],
    day_coverage: [
      {
        day: 0,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 0,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 1,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 2,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 3,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 4,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 4,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
      {
        day: 5,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 5,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
      {
        day: 6,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 6,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 7,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 7,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 8,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 8,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
      {
        day: 9,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 9,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
      {
        day: 10,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-x'],
        team_ids: [],
      },
      {
        day: 10,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
      {
        day: 11,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 11,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 12,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 12,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-y'],
        team_ids: [],
      },
      {
        day: 13,
        shift_id: 'shift-day-12',
        employee_ids: ['emp-z'],
        team_ids: [],
      },
      {
        day: 13,
        shift_id: 'shift-night-12',
        employee_ids: ['emp-aa'],
        team_ids: [],
      },
    ],
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },

  // Head Office — a plain fixed schedule, no rotation: the Office shift
  // (Mon–Fri 09:00–17:00) runs as defined, indefinitely. The kind of
  // schedule most of an organisation is actually on.
  {
    id: 'sched-office-weekdays',
    name: 'Head Office — Mon to Fri',
    description:
      'Fixed Monday-to-Friday office hours for the administration team.',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-office'],
    temporary_schedule: false,
    start_date: '2026-08-31',
    end_settings: { end_type: 'never' },
  },
]
