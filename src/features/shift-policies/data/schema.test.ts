import { describe, expect, it } from 'vitest'
import {
  getPolicyRuleTypes,
  getRuleResultMinutes,
  isMissedPunchRuleType,
  type PolicyRule,
  shiftPolicyFormSchema,
} from './schema'

const validRule = {
  id: 'rule-1',
  policy_type: 'tardy' as const,
  name: 'After the grace window',
  from_time: '09:00',
  to_time: '10:00',
  factor: 1.5,
  attendance_type: 'deduction' as const,
}

const validMissedPunchRule = {
  id: 'rule-2',
  policy_type: 'missed_punch_error' as const,
  name: 'Repeated missed punches',
  operator: 'gte' as const,
  occurrences: 3,
  period_unit: 'days' as const,
  from_period: 1,
  to_period: 30,
  attendance_type: 'deduction' as const,
  deduction_unit: 'hours' as const,
  deduction_hours: 1,
}

const policy = (rules: unknown[]) => ({
  name: 'Attendance',
  rules,
})

describe('isMissedPunchRuleType', () => {
  it('is true only for the occurrence-counting type', () => {
    expect(isMissedPunchRuleType('missed_punch_error')).toBe(true)
    expect(isMissedPunchRuleType('overtime')).toBe(false)
    expect(isMissedPunchRuleType(undefined)).toBe(false)
  })
})

describe('getRuleResultMinutes', () => {
  it('multiplies the window by the factor', () => {
    expect(
      getRuleResultMinutes({
        from_time: '09:00',
        to_time: '10:00',
        factor: 1.5,
      })
    ).toBe(90)
    expect(
      getRuleResultMinutes({ from_time: '22:00', to_time: '23:30', factor: 2 })
    ).toBe(180)
  })

  it('is 0 for a window that does not move forward', () => {
    expect(
      getRuleResultMinutes({ from_time: '10:00', to_time: '09:00', factor: 2 })
    ).toBe(0)
    expect(
      getRuleResultMinutes({ from_time: '09:00', to_time: '09:00', factor: 2 })
    ).toBe(0)
  })
})

describe('getPolicyRuleTypes', () => {
  it('lists each type once, in first-seen order', () => {
    const rules = [
      validRule,
      validMissedPunchRule,
      { ...validRule, id: 'rule-3' },
    ] as PolicyRule[]
    expect(getPolicyRuleTypes(rules)).toEqual(['tardy', 'missed_punch_error'])
  })

  it('is empty for a policy with no rules', () => {
    expect(getPolicyRuleTypes([])).toEqual([])
  })
})

describe('shiftPolicyFormSchema', () => {
  it('accepts a policy mixing rule types', () => {
    const result = shiftPolicyFormSchema.safeParse(
      policy([validRule, validMissedPunchRule])
    )
    expect(result.success).toBe(true)
  })

  it('requires at least one rule', () => {
    const result = shiftPolicyFormSchema.safeParse(policy([]))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['rules'])
  })

  it('rejects a window rule that ends before it starts', () => {
    const result = shiftPolicyFormSchema.safeParse(
      policy([{ ...validRule, from_time: '10:00', to_time: '09:00' }])
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['rules', 0, 'to_time'])
  })

  it('only allows half-steps at or above 1 for the factor', () => {
    const factors: [number, boolean][] = [
      [1, true],
      [1.5, true],
      [2, true],
      [0.5, false],
      [1.25, false],
    ]
    for (const [factor, expected] of factors) {
      const result = shiftPolicyFormSchema.safeParse(
        policy([{ ...validRule, factor }])
      )
      expect(result.success, `factor ${factor}`).toBe(expected)
    }
  })

  it('rejects a missed-punch window that ends before it starts', () => {
    const result = shiftPolicyFormSchema.safeParse(
      policy([{ ...validMissedPunchRule, from_period: 10, to_period: 5 }])
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['rules', 0, 'to_period'])
  })

  it('requires an hours value only when deducting hours', () => {
    const withoutHours = { ...validMissedPunchRule, deduction_hours: undefined }
    expect(
      shiftPolicyFormSchema.safeParse(policy([withoutHours])).success
    ).toBe(false)
    expect(
      shiftPolicyFormSchema.safeParse(
        policy([{ ...withoutHours, deduction_unit: 'full_day' }])
      ).success
    ).toBe(true)
  })

  it('rejects window fields on a missed-punch rule and vice versa', () => {
    // The discriminated union means each type only accepts its own shape —
    // a missed-punch rule missing its occurrence fields can't fall back to
    // being read as a window rule.
    const result = shiftPolicyFormSchema.safeParse(
      policy([{ ...validRule, policy_type: 'missed_punch_error' }])
    )
    expect(result.success).toBe(false)
  })
})
