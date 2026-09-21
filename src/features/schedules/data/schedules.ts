import { defaultShifts } from '@/features/shifts/data/shifts'
import {
  cellsFromCrewPlacements,
  orderShiftIdsByStart,
  patternToSlots,
} from '../rotation-crews'
import { getRotationPreset } from './rotation-presets'
import {
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type RotatePatternEntry,
  type Schedule,
} from './schema'

// Seeded demo schedules — seven records chosen to span the model rather than
// to look busy: both `regular` arms that carry crews (fixed / rotate), both
// `cycle_type` arms, all three occurrence frequencies, all three end types,
// and crews drawn both as teams and as individual employees at four different
// crew counts.
//
// Every seed starts on a **Monday** so week-shaped patterns put their rest
// cards on the weekend; a mid-week start walks them off it.
const START_DATE = '2026-08-31'

// Turns a preset's card list (indexes into `shiftIds`, `null` = rest) into the
// stored pattern — the same conversion the Pattern step's preset picker does,
// so a seed and a hand-built schedule cannot describe the same named system
// differently.
function presetPattern(
  presetId: string,
  shiftIds: string[]
): RotatePatternEntry[] {
  const preset = getRotationPreset(presetId)
  if (!preset) return []
  return preset.buildCards(shiftIds.length).map((card, index) => ({
    position: index + 1,
    shift_id: card === null ? undefined : shiftIds[card],
    is_off: card === null,
  }))
}

// `day_coverage` is the source of truth the app reads, but writing 28x3 cells
// by hand invites a typo no test would catch. Deriving them from the
// placements instead keeps the seeds satisfying
// `dayCoverageMatchesPlacements`, so the "Crew start days" read-back renders
// as generated rather than as "set by hand".
function rosterFrom(
  pattern: RotatePatternEntry[],
  shiftIds: string[],
  placements: RotateCrewPlacement[]
): RotateDayCoverage[] {
  return cellsFromCrewPlacements(
    patternToSlots(pattern),
    placements,
    orderShiftIdsByStart(shiftIds, defaultShifts)
  )
}

// --- rotate seeds: pattern + placements declared, matrix derived ---

const FACTORY_SHIFTS = ['shift-morning', 'shift-afternoon', 'shift-night']
const FACTORY_PATTERN = presetPattern('weekly_forward_28', FACTORY_SHIFTS)
const FACTORY_TEAMS = [
  'team-fac-blue',
  'team-fac-gold',
  'team-fac-red',
  'team-fac-green',
]
// Four crews a week apart keep all three shifts staffed every day of the
// 28-day cycle, with none of them changing shift mid-week.
const FACTORY_PLACEMENTS: RotateCrewPlacement[] = FACTORY_TEAMS.map(
  (id, index) => ({ crew: `team:${id}`, day_offset: index * 7, shift_step: 0 })
)

const GUARD_SHIFTS = ['shift-day-12', 'shift-night-12']
const GUARD_PATTERN = presetPattern('dupont', GUARD_SHIFTS)
const GUARD_TEAMS = [
  'team-sec-alpha',
  'team-sec-bravo',
  'team-sec-charlie',
  'team-sec-delta',
]
// DuPont's cards already alternate day and night themselves, so every crew
// rides the same shift track (`shift_step: 0`) and only the start day differs.
const GUARD_PLACEMENTS: RotateCrewPlacement[] = GUARD_TEAMS.map(
  (id, index) => ({ crew: `team:${id}`, day_offset: index * 7, shift_step: 0 })
)

const WARD_SHIFTS = ['shift-day-12', 'shift-night-12']
const WARD_PATTERN = presetPattern('pitman', WARD_SHIFTS)
const WARD_EMPLOYEES = ['emp-x', 'emp-y', 'emp-z', 'emp-aa']
// Pitman's mask names one shift only, so half the crews are transposed onto
// nights with `shift_step: 1`; the start days interleave (0/7 on days, 3/10
// on nights) so no two crews land on the same cell.
const WARD_PLACEMENTS: RotateCrewPlacement[] = [
  { crew: 'employee:emp-x', day_offset: 0, shift_step: 0 },
  { crew: 'employee:emp-y', day_offset: 3, shift_step: 1 },
  { crew: 'employee:emp-z', day_offset: 7, shift_step: 0 },
  { crew: 'employee:emp-aa', day_offset: 10, shift_step: 1 },
]

const DESK_SHIFTS = ['shift-early', 'shift-late']
const DESK_PATTERN: RotatePatternEntry[] = [
  { position: 1, shift_id: 'shift-early', is_off: false },
  { position: 2, shift_id: 'shift-late', is_off: false },
  { position: 3, is_off: true },
]
const DESK_EMPLOYEES = ['emp-e', 'emp-f', 'emp-g']
const DESK_PLACEMENTS: RotateCrewPlacement[] = DESK_EMPLOYEES.map(
  (id, index) => ({
    crew: `employee:${id}`,
    day_offset: index,
    shift_step: 0,
  })
)

export const defaultSchedules: Schedule[] = [
  // --- fixed ---

  // The global default: one shift, weekdays, one team, runs forever.
  {
    id: 'sched-office-weekdays',
    name: 'Head Office — Mon to Fri',
    description:
      'Standard 09:00–17:00 office week for the administration team. Public holidays are skipped.',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-office'],
    temporary_schedule: false,
    start_date: START_DATE,
    end_settings: { end_type: 'never' },
    shift_occurrences: [
      {
        shift_id: 'shift-office',
        frequency: 'weekly',
        interval: 1,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      },
    ],
    occurrence_exceptions: { public_holiday: true, sick_leave: false },
    crew_kind: 'team',
    shift_assignments: [
      { shift_id: 'shift-office', employee_ids: [], team_ids: ['team-office'] },
    ],
  },

  // Two shifts on *different* weekday sets, staffed by named people rather
  // than a team, and stopping on a date — the per-shift occurrence arm.
  {
    id: 'sched-retail-trading',
    name: 'Retail — Trading Week',
    description:
      'Early covers Monday to Saturday, Late covers Tuesday to Sunday, so the floor is open every day with a staggered close. Ends with the trading year.',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-early', 'shift-late'],
    temporary_schedule: false,
    start_date: START_DATE,
    end_settings: { end_type: 'on_date', end_date: '2027-06-27' },
    shift_occurrences: [
      {
        shift_id: 'shift-early',
        frequency: 'weekly',
        interval: 1,
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      },
      {
        shift_id: 'shift-late',
        frequency: 'weekly',
        interval: 1,
        weekdays: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      },
    ],
    occurrence_exceptions: { public_holiday: true, sick_leave: true },
    crew_kind: 'employee',
    shift_assignments: [
      {
        shift_id: 'shift-early',
        employee_ids: ['emp-a', 'emp-b'],
        team_ids: [],
      },
      {
        shift_id: 'shift-late',
        employee_ids: ['emp-c', 'emp-d'],
        team_ids: [],
      },
    ],
  },

  // Neither shift runs weekly: one is every fourteenth day, the other is the
  // first Saturday of the month — the daily and monthly occurrence arms, and
  // the only seed that stops after a set number of occurrences.
  {
    id: 'sched-facilities-maintenance',
    name: 'Facilities — Maintenance Windows',
    description:
      'A fortnightly daytime inspection plus a deep clean on the first Saturday night of each month. Runs for 24 occurrences.',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-day-12', 'shift-night'],
    temporary_schedule: false,
    start_date: START_DATE,
    end_settings: { end_type: 'after_occurrences', end_occurrences: 24 },
    shift_occurrences: [
      { shift_id: 'shift-day-12', frequency: 'daily', interval: 14 },
      {
        shift_id: 'shift-night',
        frequency: 'monthly',
        interval: 1,
        monthly_mode: 'day_position',
        day_position_rules: [{ position: 1, weekday: 'sat' }],
      },
    ],
    occurrence_exceptions: { public_holiday: true, sick_leave: false },
    crew_kind: 'team',
    shift_assignments: [
      { shift_id: 'shift-day-12', employee_ids: [], team_ids: ['team-a'] },
      { shift_id: 'shift-night', employee_ids: [], team_ids: ['team-b'] },
    ],
  },

  // --- rotate ---

  // Three 8-hour shifts, four team crews, a whole week on each shift then a
  // week off. Read it on the Daily tab.
  {
    id: 'sched-factory-forward',
    name: 'Factory — Continuous Line (Weekly Forward)',
    description:
      'A week of mornings, a week of afternoons, a week of nights, then a week off. Four crews a week apart keep all three shifts staffed every day.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: FACTORY_SHIFTS,
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'weekly', days: 28 },
    pattern: FACTORY_PATTERN,
    shift_repeat: [],
    crew_kind: 'team',
    crew_ids: FACTORY_TEAMS,
    crew_placements: FACTORY_PLACEMENTS,
    day_coverage: rosterFrom(
      FACTORY_PATTERN,
      FACTORY_SHIFTS,
      FACTORY_PLACEMENTS
    ),
    start_date: START_DATE,
    end_settings: { end_type: 'never' },
  },

  // Two 12-hour shifts, four team crews, the named 28-day DuPont cycle.
  {
    id: 'sched-security-dupont',
    name: 'Security — 24/7 Guard (DuPont)',
    description:
      '4 nights, 3 off, 3 days, 1 off, 3 nights, 3 off, 4 days, then a full week off. Four guard crews cover the gate around the clock.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: GUARD_SHIFTS,
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 28 },
    pattern: GUARD_PATTERN,
    shift_repeat: [],
    crew_kind: 'team',
    crew_ids: GUARD_TEAMS,
    crew_placements: GUARD_PLACEMENTS,
    day_coverage: rosterFrom(GUARD_PATTERN, GUARD_SHIFTS, GUARD_PLACEMENTS),
    start_date: START_DATE,
    end_settings: { end_type: 'never' },
  },

  // The same two 12-hour shifts, but the crews are four *individual* nurses
  // rather than teams, on the 14-day Pitman cycle, ending on a date.
  {
    id: 'sched-hospital-pitman',
    name: 'Hospital — Ward Nursing (Pitman 12h)',
    description:
      '2 on, 3 off, 2 on, 2 off, 3 on, 2 off. Four nurses rotate day and night watches, each getting a full weekend off every other week.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: WARD_SHIFTS,
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'weekly', days: 14 },
    pattern: WARD_PATTERN,
    shift_repeat: [],
    crew_kind: 'employee',
    crew_ids: WARD_EMPLOYEES,
    crew_placements: WARD_PLACEMENTS,
    day_coverage: rosterFrom(WARD_PATTERN, WARD_SHIFTS, WARD_PLACEMENTS),
    start_date: START_DATE,
    end_settings: { end_type: 'on_date', end_date: '2027-03-28' },
  },

  // The "Custom alternate" arm: the cycle is sized by each shift's repeat
  // interval (2 + 1 = 3 cards) instead of by `cycle_length`, and three people
  // chase each other around it.
  {
    id: 'sched-desk-alternation',
    name: 'Support Desk — Early / Late Alternation',
    description:
      'Early, then Late, then a rest day, alternated across three people so the desk is covered from 07:00 to 23:00 every day.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: DESK_SHIFTS,
    temporary_schedule: false,
    cycle_type: 'custom_shifts',
    cycle_length: { unit: 'custom_days', days: 3 },
    pattern: DESK_PATTERN,
    // Intervals sum to the card count. Early's allowance of 2 leaves the
    // third card free to be the rest position — a shift may use fewer cards
    // than its interval, never more.
    shift_repeat: [
      { shift_id: 'shift-early', frequency: 'daily', interval: 2 },
      { shift_id: 'shift-late', frequency: 'daily', interval: 1 },
    ],
    crew_kind: 'employee',
    crew_ids: DESK_EMPLOYEES,
    crew_placements: DESK_PLACEMENTS,
    day_coverage: rosterFrom(DESK_PATTERN, DESK_SHIFTS, DESK_PLACEMENTS),
    start_date: START_DATE,
    end_settings: { end_type: 'after_occurrences', end_occurrences: 52 },
  },
]
