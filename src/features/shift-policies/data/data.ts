import {
  type AttendanceType,
  ATTENDANCE_TYPES,
  COMPARISON_OPERATORS,
  type ComparisonOperator,
  type HolidayAttendanceType,
  type HolidayWorkMode,
  HOLIDAY_WORK_MODES,
  type HolidayWorkPolicyType,
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

const HOLIDAY_WORK_MODE_LABELS: Record<HolidayWorkMode, string> = {
  normal: 'Normal work',
  overtime: 'Apply overtime',
  substitute: 'Substitute day off',
}

export const HOLIDAY_WORK_MODE_OPTIONS = HOLIDAY_WORK_MODES.map((value) => ({
  value,
  label: HOLIDAY_WORK_MODE_LABELS[value],
}))

export function getHolidayWorkModeLabel(mode: HolidayWorkMode): string {
  return HOLIDAY_WORK_MODE_LABELS[mode]
}

const HOLIDAY_ATTENDANCE_TYPE_LABELS: Record<HolidayAttendanceType, string> = {
  paid: 'Paid',
  keep_track_overtime: 'Keep track overtime',
  leave: 'Leave',
  overtime: 'Overtime',
}

export function getHolidayAttendanceTypeLabel(
  type: HolidayAttendanceType | undefined
): string {
  return type ? HOLIDAY_ATTENDANCE_TYPE_LABELS[type] : '—'
}

// Which attendance options a holiday-work rule offers depends on both the
// policy type and the chosen work mode. Normal work has none yet, and the
// day-off overtime case books an hourly rate instead of an attendance type,
// so it has none either — those two return an empty list.
export function getHolidayAttendanceOptions(
  policyType: HolidayWorkPolicyType,
  workMode: HolidayWorkMode
): { value: HolidayAttendanceType; label: string }[] {
  const build = (values: HolidayAttendanceType[]) =>
    values.map((value) => ({
      value,
      label: HOLIDAY_ATTENDANCE_TYPE_LABELS[value],
    }))

  if (workMode === 'overtime') {
    return policyType === 'working_on_public_holiday'
      ? build(['paid', 'keep_track_overtime'])
      : []
  }
  if (workMode === 'substitute') {
    return policyType === 'working_on_public_holiday'
      ? build(['leave'])
      : build(['overtime', 'leave'])
  }
  return []
}

// The attendance value a case starts on — its first offered option, or
// undefined when the case offers none (normal work, and day-off overtime).
export function getDefaultHolidayAttendance(
  policyType: HolidayWorkPolicyType,
  workMode: HolidayWorkMode
): HolidayAttendanceType | undefined {
  return getHolidayAttendanceOptions(policyType, workMode)[0]?.value
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
