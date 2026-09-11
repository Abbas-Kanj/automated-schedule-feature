import { z } from 'zod'
import { toMinutes } from '@/lib/time'

// The policy kinds a *rule* can describe. A policy is just a named bag of
// rules, so one policy can mix several of these — see `policyRuleSchema`.
export const POLICY_TYPES = [
  'tardy',
  'departure',
  'missed_punch_error',
  'working_on_day_off',
  'working_on_public_holiday',
  'overtime',
] as const

// A rule takes one of three shapes, discriminated on `policy_type`:
//   - window types describe a from–to window with a factor (below),
//   - the two "worked when off" types take a flat hours count instead
//     (`holidayWorkRuleSchema`),
//   - "Missed punch error" counts occurrences over a span of days/months
//     (`missedPunchRuleSchema`).
// Each set is its own tuple (rather than filtered from `POLICY_TYPES`) so
// `z.enum` gets literal types.
export const WINDOW_POLICY_TYPES = ['tardy', 'departure', 'overtime'] as const
const windowPolicyTypeSchema = z.enum(WINDOW_POLICY_TYPES)

// The two "worked when you shouldn't have been" types. They don't describe a
// time window like the others — they take a flat number of hours worked plus
// how that time is treated (normal / overtime / substitute day off), so they
// carry their own rule shape (see `holidayWorkRuleSchema`).
export const HOLIDAY_WORK_POLICY_TYPES = [
  'working_on_day_off',
  'working_on_public_holiday',
] as const
const holidayWorkPolicyTypeSchema = z.enum(HOLIDAY_WORK_POLICY_TYPES)

// Which of the three rule shapes a type selects. Used by the form to swap a
// rule's inputs and by the summary row to pick what to show.
export function isMissedPunchRuleType(type: PolicyType | undefined): boolean {
  return type === 'missed_punch_error'
}

export function isHolidayWorkRuleType(
  type: PolicyType | undefined
): type is HolidayWorkPolicyType {
  return type === 'working_on_day_off' || type === 'working_on_public_holiday'
}

// How a rule's computed time is booked against the employee's attendance.
export const ATTENDANCE_TYPES = [
  'absence',
  'presence',
  'overtime',
  'grace_period',
  'deduction',
  'tracked_hours',
  'tolerance_period',
] as const
const attendanceTypeSchema = z.enum(ATTENDANCE_TYPES)

// The three ways time worked on a day off / public holiday can be treated —
// picked with a radio group, and driving which case fields the rule shows.
export const HOLIDAY_WORK_MODES = ['normal', 'overtime', 'substitute'] as const
const holidayWorkModeSchema = z.enum(HOLIDAY_WORK_MODES)

// How the holiday/day-off hours are booked. Which of these are actually
// offered depends on the policy type *and* the work mode (see
// `getHolidayAttendanceOptions` in data.ts), so the field is optional on the
// schema and its presence is enforced per-case in the policy `superRefine`.
export const HOLIDAY_ATTENDANCE_TYPES = [
  'paid',
  'keep_track_overtime',
  'leave',
  'overtime',
] as const
const holidayAttendanceTypeSchema = z.enum(HOLIDAY_ATTENDANCE_TYPES)

// How a missed-punch rule's occurrence count is compared to its threshold.
export const COMPARISON_OPERATORS = ['eq', 'gt', 'lt', 'gte', 'lte'] as const
const comparisonOperatorSchema = z.enum(COMPARISON_OPERATORS)

// Whether a missed-punch rule's from–to window counts days or months.
export const MISSED_PUNCH_PERIOD_UNITS = ['days', 'months'] as const
const missedPunchPeriodUnitSchema = z.enum(MISSED_PUNCH_PERIOD_UNITS)

// What a missed-punch rule deducts once it triggers — a number of hours, or
// a whole/half day (which resolve against the shift's own day-duration
// fields, not a fixed number of hours here).
export const MISSED_PUNCH_DEDUCTION_UNITS = [
  'hours',
  'half_day',
  'full_day',
] as const
const missedPunchDeductionUnitSchema = z.enum(MISSED_PUNCH_DEDUCTION_UNITS)

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required')

const ruleNameSchema = z.string().min(1, 'Rule name is required').max(60)

// A rule's own from–to span in minutes. 0 for a non-increasing range
// rather than a negative number — rules don't cross midnight (unlike a
// shift's time ranges), the range is a window within one day.
function getRuleSpanMinutes(from_time: string, to_time: string): number {
  if (!from_time || !to_time || !(to_time > from_time)) return 0
  return toMinutes(to_time) - toMinutes(from_time)
}

// The rule's payable/deductible result: its own span multiplied by the
// factor, in minutes. This is what the dialog shows next to the factor
// input.
export function getRuleResultMinutes(rule: {
  from_time: string
  to_time: string
  factor: number
}): number {
  return Math.round(
    getRuleSpanMinutes(rule.from_time, rule.to_time) * rule.factor
  )
}

// One configurable window inside a policy. `factor` multiplies the window's
// duration (1 = as-worked, 1.5 = time and a half, ...) — half-step only,
// which is what the number input's 0.5 step produces.
const windowRuleSchema = z.object({
  id: z.string(),
  policy_type: windowPolicyTypeSchema,
  name: ruleNameSchema,
  from_time: timeStringSchema,
  to_time: timeStringSchema,
  factor: z
    .number({ message: 'Required' })
    .min(1, 'Factor must be at least 1')
    .max(10, 'Factor must be 10 or less')
    .multipleOf(0.5, 'Factor goes up in steps of 0.5'),
  attendance_type: attendanceTypeSchema,
})

// The day-off / public-holiday rule shape: a flat number of hours worked,
// how that time is treated (`work_mode`), and the case-specific booking.
// Unlike a window rule it has no from/to span — the hours are entered
// directly. `rate_per_hour` only applies to the day-off overtime case;
// `holiday_attendance_type` only to the cases that offer a dropdown
// (everything but day-off overtime). Both are optional here and pinned
// per-case in the policy `superRefine`.
const holidayWorkRuleSchema = z.object({
  id: z.string(),
  policy_type: holidayWorkPolicyTypeSchema,
  name: ruleNameSchema,
  work_hours: z
    .number({ message: 'Required' })
    .min(0, 'Hours must be 0 or more')
    .max(24, 'Hours must be 24 or less'),
  work_mode: holidayWorkModeSchema,
  holiday_attendance_type: holidayAttendanceTypeSchema.optional(),
  rate_per_hour: z
    .number({ message: 'Required' })
    .min(0, 'Rate must be 0 or more')
    .max(1000, 'Rate must be 1000 or less')
    .optional(),
})

// The other rule shape: how many missed punches over what window, and what
// that costs. Always booked as a deduction — the form shows that as a
// disabled select rather than a choice.
const missedPunchRuleSchema = z.object({
  id: z.string(),
  policy_type: z.literal('missed_punch_error'),
  name: ruleNameSchema,
  operator: comparisonOperatorSchema,
  occurrences: z
    .number({ message: 'Required' })
    .int('Whole occurrences only')
    .min(1, 'At least 1')
    .max(999),
  period_unit: missedPunchPeriodUnitSchema,
  from_period: z
    .number({ message: 'Required' })
    .int('Whole numbers only')
    .min(1, 'At least 1')
    .max(999),
  to_period: z
    .number({ message: 'Required' })
    .int('Whole numbers only')
    .min(1, 'At least 1')
    .max(999),
  attendance_type: z.literal('deduction'),
  deduction_unit: missedPunchDeductionUnitSchema,
  deduction_hours: z.number().min(0).max(24).optional(),
})

const policyRuleSchema = z.discriminatedUnion('policy_type', [
  windowRuleSchema,
  holidayWorkRuleSchema,
  missedPunchRuleSchema,
])

// Cross-field checks live here rather than on the members so both rule
// shapes stay plain objects — `z.discriminatedUnion` needs them that way.
const policyFieldsSchema = z
  .object({
    name: z.string().min(1, 'Policy name is required').max(60),
    description: z.string().max(200).optional(),
    rules: z.array(policyRuleSchema).default([]),
  })
  .superRefine((val, ctx) => {
    if (!val.rules.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least one rule',
        path: ['rules'],
      })
    }
    val.rules.forEach((rule, index) => {
      if (rule.policy_type === 'missed_punch_error') {
        if (rule.to_period < rule.from_period) {
          ctx.addIssue({
            code: 'custom',
            message: 'Must be at least the "from" value',
            path: ['rules', index, 'to_period'],
          })
        }
        // Only the "Hours" option carries a number — half/full day take
        // their length from the shift.
        if (rule.deduction_unit === 'hours' && !rule.deduction_hours) {
          ctx.addIssue({
            code: 'custom',
            message: 'Enter the hours to deduct',
            path: ['rules', index, 'deduction_hours'],
          })
        }
        return
      }
      if (isHolidayWorkRule(rule)) {
        // Day-off overtime books an hourly rate; every other case books an
        // attendance type from a case-specific list. Normal work offers no
        // attendance options yet, so nothing is required there.
        if (rule.work_mode === 'overtime') {
          if (rule.policy_type === 'working_on_day_off') {
            if (rule.rate_per_hour == null) {
              ctx.addIssue({
                code: 'custom',
                message: 'Enter the rate per hour',
                path: ['rules', index, 'rate_per_hour'],
              })
            }
          } else if (!rule.holiday_attendance_type) {
            ctx.addIssue({
              code: 'custom',
              message: 'Select an attendance type',
              path: ['rules', index, 'holiday_attendance_type'],
            })
          }
        } else if (
          rule.work_mode === 'substitute' &&
          !rule.holiday_attendance_type
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Select an attendance type',
            path: ['rules', index, 'holiday_attendance_type'],
          })
        }
        return
      }
      if (!(rule.to_time > rule.from_time)) {
        ctx.addIssue({
          code: 'custom',
          message: 'End time must be after start time',
          path: ['rules', index, 'to_time'],
        })
      }
    })
  })

export const shiftPolicyFormSchema = policyFieldsSchema
export const shiftPolicySchema = z
  .object({ id: z.string() })
  .and(policyFieldsSchema)

export type PolicyType = (typeof POLICY_TYPES)[number]
export type WindowPolicyType = (typeof WINDOW_POLICY_TYPES)[number]
export type HolidayWorkPolicyType = (typeof HOLIDAY_WORK_POLICY_TYPES)[number]
export type HolidayWorkMode = (typeof HOLIDAY_WORK_MODES)[number]
export type HolidayAttendanceType = (typeof HOLIDAY_ATTENDANCE_TYPES)[number]
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number]
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number]
export type MissedPunchPeriodUnit = (typeof MISSED_PUNCH_PERIOD_UNITS)[number]
export type MissedPunchDeductionUnit =
  (typeof MISSED_PUNCH_DEDUCTION_UNITS)[number]
export type WindowRule = z.infer<typeof windowRuleSchema>
export type HolidayWorkRule = z.infer<typeof holidayWorkRuleSchema>
export type MissedPunchRule = z.infer<typeof missedPunchRuleSchema>
export type PolicyRule = z.infer<typeof policyRuleSchema>
export type ShiftPolicy = z.infer<typeof shiftPolicySchema>
export type ShiftPolicyFormValues = z.infer<typeof shiftPolicyFormSchema>

// Rule-level guards, so callers can narrow a `PolicyRule` to a concrete
// shape before reading shape-specific fields. Needed because the discriminant
// is spread across a literal and two enum members, which type-narrowing a
// single `policy_type` comparison doesn't always collapse cleanly.
export function isHolidayWorkRule(rule: PolicyRule): rule is HolidayWorkRule {
  return isHolidayWorkRuleType(rule.policy_type)
}

export function isWindowRule(rule: PolicyRule): rule is WindowRule {
  return (
    rule.policy_type !== 'missed_punch_error' &&
    !isHolidayWorkRuleType(rule.policy_type)
  )
}

// Every distinct type across a policy's rules, in first-seen order — what
// the table and the picker label a policy by now that the policy itself has
// no type of its own.
export function getPolicyRuleTypes(rules: PolicyRule[]): PolicyType[] {
  return [...new Set(rules.map((rule) => rule.policy_type))]
}
