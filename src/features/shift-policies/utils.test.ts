import { describe, expect, it } from 'vitest'
import { type HolidayWorkRule, type WindowRule } from './data/schema'
import {
  buildDefaultHolidayWorkRule,
  buildDefaultMissedPunchRule,
  buildDefaultRule,
  describeRule,
  formatMinutes,
  retypeRule,
} from './utils'

const identity = (time: string) => time

describe('formatMinutes', () => {
  it('drops the empty unit', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(120)).toBe('2h')
  })

  it('shows both units when both are present', () => {
    expect(formatMinutes(90)).toBe('1h 30m')
  })
})

describe('retypeRule', () => {
  const window: WindowRule = {
    ...buildDefaultRule('r1', 'tardy'),
    name: 'Late',
    from_time: '08:00',
    to_time: '09:30',
    factor: 1.5,
    attendance_type: 'deduction',
  }

  it('returns the same rule when the type does not change', () => {
    expect(retypeRule(window, 'tardy')).toBe(window)
  })

  it('keeps everything between two window types', () => {
    expect(retypeRule(window, 'overtime')).toEqual({
      ...window,
      policy_type: 'overtime',
    })
  })

  it('keeps only id and name when moving to missed punch', () => {
    expect(retypeRule(window, 'missed_punch_error')).toEqual({
      ...buildDefaultMissedPunchRule('r1'),
      name: 'Late',
    })
  })

  it('keeps only id and name when moving from a window to holiday work', () => {
    expect(retypeRule(window, 'working_on_day_off')).toEqual({
      ...buildDefaultHolidayWorkRule('r1', 'working_on_day_off'),
      name: 'Late',
    })
  })

  it('starts a blank window rule when coming from another shape', () => {
    const missed = { ...buildDefaultMissedPunchRule('r2'), name: 'Punch' }
    expect(retypeRule(missed, 'departure')).toEqual({
      ...buildDefaultRule('r2', 'departure'),
      name: 'Punch',
    })
  })

  it('keeps hours and mode between holiday types but re-defaults attendance', () => {
    const dayOff: HolidayWorkRule = {
      ...buildDefaultHolidayWorkRule('r3', 'working_on_day_off'),
      name: 'Day off',
      work_hours: 6,
      work_mode: 'overtime',
      rate_per_hour: 20,
    }
    expect(retypeRule(dayOff, 'working_on_public_holiday')).toEqual({
      id: 'r3',
      policy_type: 'working_on_public_holiday',
      name: 'Day off',
      work_hours: 6,
      work_mode: 'overtime',
      holiday_attendance_type: 'paid',
      rate_per_hour: undefined,
    })
  })
})

describe('describeRule', () => {
  it('describes a window rule with its weighted result', () => {
    const rule: WindowRule = {
      ...buildDefaultRule('r1'),
      from_time: '09:00',
      to_time: '10:30',
      factor: 1.5,
    }
    expect(describeRule(rule, identity)).toBe(
      '09:00–10:30 · ×1.5 · 2h 15m · Presence'
    )
  })

  it('omits the result for a reversed window', () => {
    const rule: WindowRule = {
      ...buildDefaultRule('r1'),
      from_time: '10:00',
      to_time: '09:00',
    }
    expect(describeRule(rule, identity)).toBe('10:00–09:00 · ×1 · Presence')
  })

  it('passes times through the caller’s formatter', () => {
    const rule = buildDefaultRule('r1')
    expect(describeRule(rule, (t) => `[${t}]`)).toMatch(/^\[09:00\]–\[10:00\]/)
  })

  it('describes a missed-punch rule', () => {
    const rule = buildDefaultMissedPunchRule('r1')
    expect(describeRule(rule, identity)).toBe(
      'is equal 1 · 1–30 days · deduct 1h'
    )
    expect(
      describeRule({ ...rule, deduction_unit: 'half_day' }, identity)
    ).toBe('is equal 1 · 1–30 days · deduct Half day')
  })

  it('describes day-off overtime with its rate and total', () => {
    const rule: HolidayWorkRule = {
      ...buildDefaultHolidayWorkRule('r1', 'working_on_day_off'),
      work_mode: 'overtime',
      rate_per_hour: 20,
    }
    expect(describeRule(rule, identity)).toBe(
      '8h · Apply overtime · 20/h · = 160'
    )
  })

  it('describes other holiday-work cases with their attendance, if any', () => {
    const normal = buildDefaultHolidayWorkRule(
      'r1',
      'working_on_public_holiday'
    )
    expect(describeRule(normal, identity)).toBe('8h · Normal work')
    expect(
      describeRule(
        {
          ...normal,
          work_mode: 'substitute',
          holiday_attendance_type: 'leave',
        },
        identity
      )
    ).toBe('8h · Substitute day off · Leave')
  })
})
