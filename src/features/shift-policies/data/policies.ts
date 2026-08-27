import { type ShiftPolicy } from './schema'

// Seed policies — the store falls back to these when nothing is in
// localStorage yet (same pattern as `shifts/data/shifts.ts`). Fixed ids so
// a shift's `policy_ids` reference survives a reload. A policy is a bag of
// typed rules, so "Attendance" below deliberately mixes three types.
export const defaultShiftPolicies: ShiftPolicy[] = [
  {
    id: 'policy-late-arrival',
    name: 'Late arrival',
    description: 'Flags and deducts time for clock-ins after the grace window.',
    rules: [
      {
        id: 'policy-late-arrival-rule-1',
        policy_type: 'tardy',
        name: 'First 15 minutes',
        from_time: '09:00',
        to_time: '09:15',
        factor: 1,
        attendance_type: 'grace_period',
      },
      {
        id: 'policy-late-arrival-rule-2',
        policy_type: 'tardy',
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
    rules: [
      {
        id: 'policy-weekend-overtime-rule-1',
        policy_type: 'working_on_day_off',
        name: 'Day-off hours',
        work_hours: 8,
        work_mode: 'overtime',
        rate_per_hour: 1.5,
      },
    ],
  },
  {
    id: 'policy-missed-punch',
    name: 'Attendance',
    description:
      'Early departures, missed punches, and holiday work in one policy.',
    rules: [
      {
        id: 'policy-missed-punch-rule-1',
        policy_type: 'missed_punch_error',
        name: 'Repeated missed punches',
        operator: 'gte',
        occurrences: 3,
        period_unit: 'days',
        from_period: 1,
        to_period: 30,
        attendance_type: 'deduction',
        deduction_unit: 'hours',
        deduction_hours: 1,
      },
      {
        id: 'policy-missed-punch-rule-2',
        policy_type: 'departure',
        name: 'Left before the shift ended',
        from_time: '16:00',
        to_time: '17:00',
        factor: 1,
        attendance_type: 'deduction',
      },
      {
        id: 'policy-missed-punch-rule-3',
        policy_type: 'working_on_public_holiday',
        name: 'Public holiday hours',
        work_hours: 8,
        work_mode: 'overtime',
        holiday_attendance_type: 'paid',
      },
    ],
  },
]
