import { describe, expect, it } from 'vitest'
import {
  getRuleResultMinutes,
  policyTypeHasRules,
  shiftPolicyFormSchema,
} from './schema'

const validRule = {
  id: 'rule-1',
  name: 'After the grace window',
  from_time: '09:00',
  to_time: '10:00',
  factor: 1.5,
  attendance_type: 'deduction' as const,
}

describe('policyTypeHasRules', () => {
  it('is true for every type except missed punch error', () => {
    expect(policyTypeHasRules('overtime')).toBe(true)
    expect(policyTypeHasRules('tardy')).toBe(true)
    expect(policyTypeHasRules('working_on_public_holiday')).toBe(true)
    expect(policyTypeHasRules('missed_punch_error')).toBe(false)
  })

  it('is false while no type is selected yet', () => {
    expect(policyTypeHasRules(undefined)).toBe(false)
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

describe('shiftPolicyFormSchema', () => {
  it('accepts a rule-bearing policy with at least one rule', () => {
    const result = shiftPolicyFormSchema.safeParse({
      name: 'Late arrival',
      policy_type: 'tardy',
      rules: [validRule],
    })
    expect(result.success).toBe(true)
  })

  it('requires a rule-bearing policy to carry a rule', () => {
    const result = shiftPolicyFormSchema.safeParse({
      name: 'Late arrival',
      policy_type: 'tardy',
      rules: [],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['rules'])
  })

  it('accepts a missed-punch policy with no rules at all', () => {
    const result = shiftPolicyFormSchema.safeParse({
      name: 'Missed punch',
      policy_type: 'missed_punch_error',
      rules: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a rule that ends before it starts', () => {
    const result = shiftPolicyFormSchema.safeParse({
      name: 'Late arrival',
      policy_type: 'tardy',
      rules: [{ ...validRule, from_time: '10:00', to_time: '09:00' }],
    })
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
      const result = shiftPolicyFormSchema.safeParse({
        name: 'Late arrival',
        policy_type: 'tardy',
        rules: [{ ...validRule, factor }],
      })
      expect(result.success, `factor ${factor}`).toBe(expected)
    }
  })
})
