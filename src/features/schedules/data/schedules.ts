import { employees } from './employees'
import { type Schedule } from './schema'

export const defaultSchedules: Schedule[] = [
  {
    id: 'sched-1',
    name: 'Front Desk Coverage',
    description: 'Reception coverage split across the morning and afternoon.',
    employees: [employees[0], employees[1]],
    parent_type: 'daily',
    type: 'weekly_one',
    days: [
      {
        day: 'monday',
        times: [
          { from_time: '09:00', to_time: '13:00' },
          { from_time: '14:00', to_time: '17:00' },
        ],
      },
      {
        day: 'wednesday',
        times: [
          { from_time: '09:00', to_time: '13:00' },
          { from_time: '14:00', to_time: '17:00' },
        ],
      },
      {
        day: 'friday',
        times: [
          { from_time: '09:00', to_time: '13:00' },
          { from_time: '14:00', to_time: '17:00' },
        ],
      },
    ],
  },
  {
    id: 'sched-2',
    name: 'Warehouse Shift',
    description: 'Weekly warehouse coverage for the middle week of July.',
    employees: [employees[2], employees[3], employees[4]],
    parent_type: 'daily',
    type: 'weekly',
    year: 2026,
    month: 7,
    week: { start_date: '2026-07-12', end_date: '2026-07-18' },
    days: [
      {
        day: 'sunday',
        times: [{ from_time: '08:00', to_time: '16:00' }],
      },
      {
        day: 'tuesday',
        times: [{ from_time: '08:00', to_time: '16:00' }],
      },
      {
        day: 'thursday',
        times: [{ from_time: '10:00', to_time: '18:00' }],
      },
    ],
  },
  {
    id: 'sched-3',
    name: 'Quarterly Audit',
    description: 'On-site audit support across two months.',
    employees: [employees[5]],
    parent_type: 'daily',
    type: 'monthly',
    year: 2026,
    months: [
      {
        month: 8,
        days: [
          { day: 3, times: [{ from_time: '09:00', to_time: '12:00' }] },
          { day: 17, times: [{ from_time: '09:00', to_time: '12:00' }] },
        ],
      },
      {
        month: 11,
        days: [{ day: 5, times: [{ from_time: '13:00', to_time: '17:00' }] }],
      },
    ],
  },
  {
    id: 'sched-rotation',
    name: 'Store Floor Rotation',
    description:
      'Morning → Afternoon → Night → Off cycle, rotated across the floor team.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-morning', 'shift-afternoon', 'shift-night'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 4 },
    // Four cycle positions — three shifts plus a day off. Employees don't
    // live here: the Schedule Rotation screen derives them from each
    // referenced shift's own Assign-to picks (see
    // `features/schedule-rotation`).
    pattern: [
      { position: 1, shift_id: 'shift-morning', is_off: false },
      { position: 2, shift_id: 'shift-afternoon', is_off: false },
      { position: 3, shift_id: 'shift-night', is_off: false },
      { position: 4, is_off: true },
    ],
    shift_repeat: [],
    start_date: '2026-08-17',
    end_settings: { end_type: 'never' },
  },
  {
    id: 'sched-rotation-line',
    name: 'Production Line Rotation',
    description:
      'Two 12-hour crews on a seven-day block: three days, two nights, two off.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-line-day', 'shift-line-night'],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    // The `weekly` unit is a flat 7 days per week picked — see
    // `CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS`, which is what the pattern
    // builder writes into `days` when the unit is chosen.
    cycle_length: { unit: 'weekly', days: 7 },
    // A "block" pattern: unlike Store Floor Rotation, the same shift holds
    // several consecutive positions, so a crew stays on days (or nights)
    // for a stretch before switching. Only two distinct shifts means only
    // two starting offsets — the rotation runs as two crews, not seven.
    pattern: [
      { position: 1, shift_id: 'shift-line-day', is_off: false },
      { position: 2, shift_id: 'shift-line-day', is_off: false },
      { position: 3, shift_id: 'shift-line-day', is_off: false },
      { position: 4, shift_id: 'shift-line-night', is_off: false },
      { position: 5, shift_id: 'shift-line-night', is_off: false },
      { position: 6, is_off: true },
      { position: 7, is_off: true },
    ],
    shift_repeat: [],
    start_date: '2026-08-03',
    end_settings: { end_type: 'never' },
  },
  {
    id: 'sched-rotation-desk',
    name: 'Support Desk Rotation',
    description:
      'Nine-day custom alternate: three days early, three late, two nights, one off.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: ['shift-desk-early', 'shift-desk-late', 'shift-desk-night'],
    // A pilot arrangement rather than the standing one — exercises the
    // temporary-schedule label alongside a fixed end date below.
    temporary_schedule: true,
    temporary_schedule_label: 'Pilot – H2 2026',
    // "Custom alternate": the cycle's length comes from the per-shift
    // repeat intervals below (3 + 3 + 3 = 9 cards), not from
    // `cycle_length`, and each card stays individually reassignable — which
    // is how the night shift ends up using only 2 of its 3 allowed cards,
    // leaving the ninth card free as the cycle's rest day.
    cycle_type: 'custom_shifts',
    cycle_length: { unit: 'custom_days', days: 9 },
    pattern: [
      { position: 1, shift_id: 'shift-desk-early', is_off: false },
      { position: 2, shift_id: 'shift-desk-early', is_off: false },
      { position: 3, shift_id: 'shift-desk-early', is_off: false },
      { position: 4, shift_id: 'shift-desk-late', is_off: false },
      { position: 5, shift_id: 'shift-desk-late', is_off: false },
      { position: 6, shift_id: 'shift-desk-late', is_off: false },
      { position: 7, shift_id: 'shift-desk-night', is_off: false },
      { position: 8, shift_id: 'shift-desk-night', is_off: false },
      { position: 9, is_off: true },
    ],
    shift_repeat: [
      { shift_id: 'shift-desk-early', frequency: 'daily', interval: 3 },
      { shift_id: 'shift-desk-late', frequency: 'daily', interval: 3 },
      { shift_id: 'shift-desk-night', frequency: 'daily', interval: 3 },
    ],
    start_date: '2026-08-10',
    end_settings: { end_type: 'on_date', end_date: '2027-06-30' },
  },
  {
    id: 'sched-rotation-oncall',
    name: 'On-Call Duty Rotation',
    description:
      'Primary → Backup → Escalation → Off, handed over once a month.',
    parent_type: 'regular',
    type: 'rotate',
    shift_ids: [
      'shift-oncall-primary',
      'shift-oncall-backup',
      'shift-oncall-escalation',
    ],
    temporary_schedule: false,
    cycle_type: 'pattern_shifts',
    cycle_length: { unit: 'custom_days', days: 4 },
    // Same four-position shape as Store Floor Rotation, but meant to be
    // read with the Schedule Rotation screen's "Monthly" tab — one position
    // per calendar month, so a tier is held for a month at a time and each
    // crew gets a full month off every fourth month.
    pattern: [
      { position: 1, shift_id: 'shift-oncall-primary', is_off: false },
      { position: 2, shift_id: 'shift-oncall-backup', is_off: false },
      { position: 3, shift_id: 'shift-oncall-escalation', is_off: false },
      { position: 4, is_off: true },
    ],
    shift_repeat: [],
    start_date: '2026-08-01',
    end_settings: { end_type: 'after_occurrences', end_occurrences: 12 },
  },
]
