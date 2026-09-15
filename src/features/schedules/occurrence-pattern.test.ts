import { describe, expect, it } from 'vitest'
import { DEFAULT_OCCURRENCE, type Occurrence } from './data/schema'
import { occurrencePattern } from './occurrence-pattern'

const working = (pattern: ReturnType<typeof occurrencePattern>) =>
  pattern.map((card) => (card.is_off ? '.' : 'W')).join('')

describe('occurrencePattern', () => {
  it('anchors a weekly rule on the start date', () => {
    // 2026-08-31 is a Monday, so Mon–Fri is the first five cards.
    const pattern = occurrencePattern(DEFAULT_OCCURRENCE, '2026-08-31', 's1')

    expect(working(pattern)).toBe('WWWWW..')
    expect(pattern.filter((c) => !c.is_off).every((c) => c.shift_id === 's1'))
      .toBe(true)
  })

  it('shifts the working cards when the start is mid-week', () => {
    // 2026-09-03 is a Thursday: Thu, Fri, then the weekend, then Mon–Wed.
    const pattern = occurrencePattern(DEFAULT_OCCURRENCE, '2026-09-03', 's1')

    expect(working(pattern)).toBe('WW..WWW')
  })

  it('makes an every-N-weeks rule a 7N-day cycle working only its first week', () => {
    const everyTwo: Occurrence = { ...DEFAULT_OCCURRENCE, interval: 2 }
    const pattern = occurrencePattern(everyTwo, '2026-08-31', 's1')

    expect(pattern).toHaveLength(14)
    expect(working(pattern)).toBe('WWWWW..' + '.......')
  })

  it('makes an every-N-days rule an N-day cycle working its first day', () => {
    const everyThree: Occurrence = {
      ...DEFAULT_OCCURRENCE,
      frequency: 'daily',
      interval: 3,
    }

    expect(working(occurrencePattern(everyThree, '2026-08-31', 's1'))).toBe(
      'W..'
    )
  })

  it('makes an every-N-months rule a 30N-day cycle working the matching days', () => {
    const monthly: Occurrence = {
      ...DEFAULT_OCCURRENCE,
      frequency: 'monthly',
      interval: 2,
      monthly_mode: 'date_specific',
      date_specific_1: 1,
      date_specific_2: 15,
    }
    // Starts 2026-08-31, so card 1 is Sep 1 and card 15 is Sep 15.
    const pattern = occurrencePattern(monthly, '2026-08-31', 's1')

    expect(pattern).toHaveLength(60)
    expect(
      pattern.flatMap((card, i) => (card.is_off ? [] : [i]))
    ).toEqual([1, 15])
  })

  it('reads a day-position rule as that weekday in that week of the month', () => {
    const secondMonday: Occurrence = {
      ...DEFAULT_OCCURRENCE,
      frequency: 'monthly',
      interval: 1,
      monthly_mode: 'day_position',
      day_position_rules: [{ position: 2, weekday: 'mon' }],
    }
    // 2026-09-14 is September's second Monday: card 14 from Aug 31.
    const pattern = occurrencePattern(secondMonday, '2026-08-31', 's1')

    expect(
      pattern.flatMap((card, i) => (card.is_off ? [] : [i]))
    ).toEqual([14])
  })

  it('has nothing to staff without a shift', () => {
    expect(occurrencePattern(DEFAULT_OCCURRENCE, '2026-08-31', undefined))
      .toEqual([])
  })
})
