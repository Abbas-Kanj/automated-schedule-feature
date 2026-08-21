import { type ShiftPolicy } from './schema'

// Seed policies — the store falls back to these when nothing is in
// localStorage yet (same pattern as `shifts/data/shifts.ts`). Fixed ids so
// a shift's `policy_ids` reference survives a reload.
export const defaultShiftPolicies: ShiftPolicy[] = [
  {
    id: 'policy-late-arrival',
    name: 'Late arrival',
    description: 'Flags and deducts time for clock-ins after the grace window.',
    policy_type: 'tardy',
    rules: [
      {
        id: 'policy-late-arrival-rule-1',
        name: 'First 15 minutes',
        from_time: '09:00',
        to_time: '09:15',
        factor: 1,
        attendance_type: 'grace_period',
      },
      {
        id: 'policy-late-arrival-rule-2',
        name: 'After the grace window',
        from_time: '09:15',
        to_time: '10:00',
        factor: 1.5,
        attendance_type: 'deduction',
      },
    ],
  },
  {
    id: 'policy-weekend-overtime',
    name: 'Weekend overtime',
    description: 'Time and a half for hours worked on a scheduled day off.',
    policy_type: 'working_on_day_off',
    rules: [
      {
        id: 'policy-weekend-overtime-rule-1',
        name: 'Day-off hours',
        from_time: '09:00',
        to_time: '17:00',
        factor: 1.5,
        attendance_type: 'overtime',
      },
    ],
  },
  {
    id: 'policy-missed-punch',
    name: 'Missed punch',
    description:
      'Raises a review task when a clock-in or clock-out is missing.',
    policy_type: 'missed_punch_error',
    rules: [],
  },
]
