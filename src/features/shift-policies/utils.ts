import {
  getAttendanceTypeLabel,
  getComparisonOperatorLabel,
  getMissedPunchDeductionUnitLabel,
  getMissedPunchPeriodUnitLabel,
} from './data/data'
import {
  getRuleResultMinutes,
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

// Swaps a rule to another type, keeping what both shapes share (its id and
// name) and defaulting the rest. A move between two window types keeps
// everything, since only the type itself differs.
export function retypeRule(
  rule: WindowRule | MissedPunchRule,
  next: PolicyType
): WindowRule | MissedPunchRule {
  if (next === 'missed_punch_error') {
    return { ...buildDefaultMissedPunchRule(rule.id), name: rule.name }
  }
  if (rule.policy_type === 'missed_punch_error') {
    return { ...buildDefaultRule(rule.id, next), name: rule.name }
  }
  return { ...rule, policy_type: next }
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

  const resultMinutes = getRuleResultMinutes({
    from_time: rule.from_time,
    to_time: rule.to_time,
    factor: Number(rule.factor) || 0,
  })
  const result = resultMinutes > 0 ? ` · ${formatMinutes(resultMinutes)}` : ''
  return `${formatTime(rule.from_time)}–${formatTime(rule.to_time)} · ×${rule.factor ?? '—'}${result} · ${getAttendanceTypeLabel(rule.attendance_type)}`
}
