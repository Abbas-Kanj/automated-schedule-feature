import { describe, expect, it } from 'vitest'
import { DEFAULT_OCCURRENCE, type OccurrenceRule } from './data/schema'
import { occurrenceLabels, occursOn } from './occurrence-pattern'

// Local dates so weekday arithmetic isn't at the mercy of the runner's zone.
const day = (month: number, date: number) => new Date(2026, month - 1, date)

describe('occurrenceLabels', () => {
  it('lists a weekly rule’s weekdays Monday first', () => {
    expect(
      occurrenceLabels({
        ...DEFAULT_OCCURRENCE,
        weekdays: ['fri', 'mon', 'wed'],
      })
    ).toEqual(['Mon', 'Wed', 'Fri'])
  })

  it('names a daily rule by its cadence', () => {
    expect(
      occurrenceLabels({
        ...DEFAULT_OCCURRENCE,
        frequency: 'daily',
        interval: 3,
      })
    ).toEqual(['Every 3 days'])
  })

  it('lists monthly dates deduplicated and sorted', () => {
    const monthly: OccurrenceRule = {
      ...DEFAULT_OCCURRENCE,
      frequency: 'monthly',
      interval: 2,
      monthly_mode: 'date_specific',
      date_specific_1: 15,
      date_specific_2: 1,
    }
    expect(occurrenceLabels(monthly)).toEqual(['Day 1', 'Day 15'])
    expect(occurrenceLabels({ ...monthly, date_specific_2: 15 })).toEqual([
      'Day 15',
    ])
  })

  it('names a day-position rule', () => {
    expect(
      occurrenceLabels({
        ...DEFAULT_OCCURRENCE,
        frequency: 'monthly',
        monthly_mode: 'day_position',
        day_position_rules: [{ position: 2, weekday: 'mon' }],
      })
    ).toEqual(['2nd Mon'])
  })

  it('is empty without a rule', () => {
    expect(occurrenceLabels(undefined)).toEqual([])
  })
})

describe('occursOn', () => {
  it('counts a weekly interval from the week the schedule starts in', () => {
    const rule: OccurrenceRule = {
      frequency: 'weekly',
      interval: 2,
      weekdays: ['mon', 'wed'],
    }
    const start = day(9, 2) // Wednesday
    expect(occursOn(rule, start, day(9, 2))).toBe(true)
    expect(occursOn(rule, start, day(9, 7))).toBe(false)
    expect(occursOn(rule, start, day(9, 9))).toBe(false)
    expect(occursOn(rule, start, day(9, 14))).toBe(true)
  })

  it('matches a monthly day position to the right week of the month', () => {
    const rule: OccurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      monthly_mode: 'day_position',
      day_position_rules: [{ position: 2, weekday: 'mon' }],
    }
    const start = day(9, 1)
    expect(occursOn(rule, start, day(9, 7))).toBe(false)
    expect(occursOn(rule, start, day(9, 14))).toBe(true)
  })

  it('steps a daily interval from the start date', () => {
    const rule: OccurrenceRule = { frequency: 'daily', interval: 2 }
    const start = day(9, 1)
    expect(occursOn(rule, start, day(9, 3))).toBe(true)
    expect(occursOn(rule, start, day(9, 4))).toBe(false)
  })
})
