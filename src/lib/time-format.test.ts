import { describe, expect, it } from 'vitest'
import { formatClockTime } from './time-format'

describe('formatClockTime', () => {
  it('keeps 24-hour times as-is', () => {
    expect(formatClockTime('09:00', false)).toBe('09:00')
    expect(formatClockTime('15:30', false)).toBe('15:30')
    expect(formatClockTime('00:00', false)).toBe('00:00')
    expect(formatClockTime('23:59', false)).toBe('23:59')
  })

  it('converts to 12-hour with am/pm', () => {
    expect(formatClockTime('09:00', true)).toBe('9:00 am')
    expect(formatClockTime('15:30', true)).toBe('3:30 pm')
    expect(formatClockTime('00:00', true)).toBe('12:00 am')
    expect(formatClockTime('12:00', true)).toBe('12:00 pm')
    expect(formatClockTime('23:59', true)).toBe('11:59 pm')
    expect(formatClockTime('09:05', true)).toBe('9:05 am')
  })

  it('passes through values that are not HH:mm untouched', () => {
    expect(formatClockTime('', true)).toBe('')
    expect(formatClockTime('9am', true)).toBe('9am')
    expect(formatClockTime('9:00', true)).toBe('9:00')
  })
})
