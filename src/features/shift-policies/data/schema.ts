import { z } from 'zod'
import { toMinutes } from '@/lib/time'

// The policy kinds a shift policy can describe. `missed_punch_error` is the
// odd one out: it's a pure flagging policy with no time window or factor to
// configure, so it carries no rules (see `policyTypeHasRules`).
export const POLICY_TYPES = [
  'tardy',
  'departure',
  'missed_punch_error',
  'working_on_day_off',
  'working_on_public_holiday',
  'overtime',
] as const
const policyTypeSchema = z.enum(POLICY_TYPES)

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

// Every type except "Missed punch error" configures its behaviour through
// one or more rules. Used by both the form (to show/hide the rules
// section) and the schema (to require at least one).
export function policyTypeHasRules(type: PolicyType | undefined): boolean {
  return !!type && type !== 'missed_punch_error'
}

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required')

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
const policyRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Rule name is required').max(60),
  from_time: timeStringSchema,
  to_time: timeStringSchema,
  factor: z
    .number({ message: 'Required' })
    .min(1, 'Factor must be at least 1')
    .max(10, 'Factor must be 10 or less')
    .multipleOf(0.5, 'Factor goes up in steps of 0.5'),
  attendance_type: attendanceTypeSchema,
})

const policyFieldsSchema = z
  .object({
    name: z.string().min(1, 'Policy name is required').max(60),
    description: z.string().max(200).optional(),
    policy_type: policyTypeSchema,
    rules: z.array(policyRuleSchema).default([]),
  })
  .superRefine((val, ctx) => {
    if (!policyTypeHasRules(val.policy_type)) return

    if (!val.rules.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least one rule',
        path: ['rules'],
      })
    }
    val.rules.forEach((rule, index) => {
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
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number]
export type PolicyRule = z.infer<typeof policyRuleSchema>
export type ShiftPolicy = z.infer<typeof shiftPolicySchema>
export type ShiftPolicyFormValues = z.infer<typeof shiftPolicyFormSchema>
