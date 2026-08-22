import {
  type AttendanceType,
  ATTENDANCE_TYPES,
  COMPARISON_OPERATORS,
  type ComparisonOperator,
  MISSED_PUNCH_DEDUCTION_UNITS,
  MISSED_PUNCH_PERIOD_UNITS,
  type MissedPunchDeductionUnit,
  type MissedPunchPeriodUnit,
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

const COMPARISON_OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  eq: 'Is Equal',
  gt: 'Is Greater Than',
  lt: 'Is Less Than',
  gte: 'Is Greater Than or Equal',
  lte: 'Is Less Than or Equal',
}

export const COMPARISON_OPERATOR_OPTIONS = COMPARISON_OPERATORS.map(
  (value) => ({ value, label: COMPARISON_OPERATOR_LABELS[value] })
)

export function getComparisonOperatorLabel(
  operator: ComparisonOperator | undefined
): string {
  return operator ? COMPARISON_OPERATOR_LABELS[operator] : '—'
}

const MISSED_PUNCH_PERIOD_UNIT_LABELS: Record<MissedPunchPeriodUnit, string> = {
  days: 'Days',
  months: 'Month',
}

export const MISSED_PUNCH_PERIOD_UNIT_OPTIONS = MISSED_PUNCH_PERIOD_UNITS.map(
  (value) => ({ value, label: MISSED_PUNCH_PERIOD_UNIT_LABELS[value] })
)

export function getMissedPunchPeriodUnitLabel(
  unit: MissedPunchPeriodUnit
): string {
  return MISSED_PUNCH_PERIOD_UNIT_LABELS[unit]
}

const MISSED_PUNCH_DEDUCTION_UNIT_LABELS: Record<
  MissedPunchDeductionUnit,
  string
> = {
  hours: 'Hours',
  half_day: 'Half day',
  full_day: 'Full day',
}

export const MISSED_PUNCH_DEDUCTION_UNIT_OPTIONS =
  MISSED_PUNCH_DEDUCTION_UNITS.map((value) => ({
    value,
    label: MISSED_PUNCH_DEDUCTION_UNIT_LABELS[value],
  }))

export function getMissedPunchDeductionUnitLabel(
  unit: MissedPunchDeductionUnit
): string {
  return MISSED_PUNCH_DEDUCTION_UNIT_LABELS[unit]
}
