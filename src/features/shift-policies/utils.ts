import {
  getAttendanceTypeLabel,
  getComparisonOperatorLabel,
  getDefaultHolidayAttendance,
  getHolidayAttendanceTypeLabel,
  getHolidayWorkModeLabel,
  getMissedPunchDeductionUnitLabel,
  getMissedPunchPeriodUnitLabel,
} from './data/data'
import {
  getRuleResultMinutes,
  type HolidayWorkPolicyType,
  type HolidayWorkRule,
  isHolidayWorkRule,
  isHolidayWorkRuleType,
  type MissedPunchRule,
  type PolicyRule,
  type PolicyType,
  type WindowPolicyType,
  type WindowRule,
} from './data/schema'

// Formats a duration in minutes as a compact "Xh Ym" string — the rule
// result readout's format, e.g. 90 -> "1h 30m", 120 -> "2h", 45 -> "45m".
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// A blank window rule — 1x factor over an hour, booked as presence. Mirrors
// the "sensible default rather than empty inputs" approach the shift
// form's break rows take.
export function buildDefaultRule(
  id: string,
  policy_type: WindowPolicyType = 'tardy'
): WindowRule {
  return {
    id,
    policy_type,
    name: '',
    from_time: '09:00',
    to_time: '10:00',
    factor: 1,
    attendance_type: 'presence',
  }
}

// A blank day-off / public-holiday rule — 8 hours worked, treated as normal
// work (so no attendance option or rate yet; those appear once the mode
// switches to overtime or substitute).
export function buildDefaultHolidayWorkRule(
  id: string,
  policy_type: HolidayWorkPolicyType
): HolidayWorkRule {
  return {
    id,
    policy_type,
    name: '',
    work_hours: 8,
    work_mode: 'normal',
    holiday_attendance_type: undefined,
    rate_per_hour: undefined,
  }
}

// The other shape: one missed punch over a month of days, deducting an
// hour. `attendance_type` is fixed at 'deduction' by the schema — the form
// shows it as a disabled select.
export function buildDefaultMissedPunchRule(id: string): MissedPunchRule {
  return {
    id,
    policy_type: 'missed_punch_error',
    name: '',
    operator: 'eq',
    occurrences: 1,
    period_unit: 'days',
    from_period: 1,
    to_period: 30,
    attendance_type: 'deduction',
    deduction_unit: 'hours',
    deduction_hours: 1,
  }
}

// Swaps a rule to another type, keeping what the shapes share (its id and
// name) and defaulting the rest. A move between two window types keeps
// everything; a move between the two holiday-work types also keeps the hours
// and mode, resetting only the case fields whose options differ.
export function retypeRule(rule: PolicyRule, next: PolicyType): PolicyRule {
  if (rule.policy_type === next) return rule

  if (next === 'missed_punch_error') {
    return { ...buildDefaultMissedPunchRule(rule.id), name: rule.name }
  }

  if (isHolidayWorkRuleType(next)) {
    const base = buildDefaultHolidayWorkRule(rule.id, next)
    if (isHolidayWorkRuleType(rule.policy_type)) {
      const prev = rule as HolidayWorkRule
      return {
        ...base,
        name: rule.name,
        work_hours: prev.work_hours,
        work_mode: prev.work_mode,
        holiday_attendance_type: getDefaultHolidayAttendance(
          next,
          prev.work_mode
        ),
      }
    }
    return { ...base, name: rule.name }
  }

  // `next` is a plain window type here.
  if (
    rule.policy_type === 'tardy' ||
    rule.policy_type === 'departure' ||
    rule.policy_type === 'overtime'
  ) {
    // window → window keeps everything but the type.
    return { ...rule, policy_type: next }
  }
  // Coming from missed-punch or holiday work — nothing window-shaped to
  // carry over, so start from a blank window rule.
  return { ...buildDefaultRule(rule.id, next), name: rule.name }
}

// One line describing what a rule does, in whichever shape it takes — the
// collapsed rule row and the read-only details dialog show the same text.
// `formatTime` comes from the caller's `useTimeFormat`, so the window
// follows the user's 12/24-hour display preference.
export function describeRule(
  rule: PolicyRule,
  formatTime: (time: string) => string
): string {
  if (rule.policy_type === 'missed_punch_error') {
    const period = getMissedPunchPeriodUnitLabel(rule.period_unit).toLowerCase()
    const deducted =
      rule.deduction_unit === 'hours'
        ? `${rule.deduction_hours ?? 0}h`
        : getMissedPunchDeductionUnitLabel(rule.deduction_unit)
    return `${getComparisonOperatorLabel(rule.operator).toLowerCase()} ${rule.occurrences} · ${rule.from_period}–${rule.to_period} ${period} · deduct ${deducted}`
  }

  if (isHolidayWorkRule(rule)) {
    const hours = rule.work_hours ?? 0
    const mode = getHolidayWorkModeLabel(rule.work_mode)
    if (
      rule.work_mode === 'overtime' &&
      rule.policy_type === 'working_on_day_off'
    ) {
      const rate = rule.rate_per_hour ?? 0
      return `${hours}h · ${mode} · ${rate}/h · = ${rate * hours}`
    }
    const attendance = rule.holiday_attendance_type
      ? ` · ${getHolidayAttendanceTypeLabel(rule.holiday_attendance_type)}`
      : ''
    return `${hours}h · ${mode}${attendance}`
  }

  const resultMinutes = getRuleResultMinutes({
    from_time: rule.from_time,
    to_time: rule.to_time,
    factor: Number(rule.factor) || 0,
  })
  const result = resultMinutes > 0 ? ` · ${formatMinutes(resultMinutes)}` : ''
  return `${formatTime(rule.from_time)}–${formatTime(rule.to_time)} · ×${rule.factor ?? '—'}${result} · ${getAttendanceTypeLabel(rule.attendance_type)}`
}
