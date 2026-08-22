import {
  type AttendanceType,
  ATTENDANCE_TYPES,
  type PolicyType,
  POLICY_TYPES,
} from './schema'

const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  tardy: 'Tardy',
  departure: 'Departure',
  missed_punch_error: 'Missed Punch Error',
  working_on_day_off: 'Working on Day Off',
  working_on_public_holiday: 'Working on Public Holiday',
  overtime: 'Overtime',
}

export const POLICY_TYPE_OPTIONS = POLICY_TYPES.map((value) => ({
  value,
  label: POLICY_TYPE_LABELS[value],
}))

export function getPolicyTypeLabel(type: PolicyType | undefined): string {
  return type ? POLICY_TYPE_LABELS[type] : '—'
}

const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  absence: 'Absence',
  presence: 'Presence',
  overtime: 'Overtime',
  grace_period: 'Grace Period',
  deduction: 'Deduction',
  tracked_hours: 'Tracked Hours',
  tolerance_period: 'Tolerance Period',
}

export const ATTENDANCE_TYPE_OPTIONS = ATTENDANCE_TYPES.map((value) => ({
  value,
  label: ATTENDANCE_TYPE_LABELS[value],
}))

export function getAttendanceTypeLabel(
  type: AttendanceType | undefined
): string {
  return type ? ATTENDANCE_TYPE_LABELS[type] : '—'
}
