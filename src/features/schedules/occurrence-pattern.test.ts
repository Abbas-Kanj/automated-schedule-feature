import { describe, expect, it } from 'vitest'
import { DEFAULT_OCCURRENCE, type Occurrence } from './data/schema'
import { occurrenceSlots } from './occurrence-pattern'

describe('occurrenceSlots', () => {
  it('gives a weekly rule one slot per chosen weekday, Monday first', () => {
    const slots = occurrenceSlots(
      { ...DEFAULT_OCCURRENCE, weekdays: ['fri', 'mon', 'wed'] },
      's1'
    )

    expect(slots.labels).toEqual(['Mon', 'Wed', 'Fri'])
    expect(slots.slotKeys).toEqual([1000, 1002, 1004])
    expect(slots.pattern.every((c) => !c.is_off && c.shift_id === 's1')).toBe(
      true
    )
  })

  // The whole point of the keys: "Team A on Tuesday" must not move when the
  // start date is set later, and the interval only changes the cadence.
  it('keys weekdays without reference to the start date or interval', () => {
    const everyWeek = occurrenceSlots(DEFAULT_OCCURRENCE, 's1')
    const everyThree = occurrenceSlots(
      { ...DEFAULT_OCCURRENCE, interval: 3 },
      's1'
    )

    expect(everyThree.slotKeys).toEqual(everyWeek.slotKeys)
    expect(everyWeek.labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  })

  it('gives a daily rule a single slot', () => {
    const slots = occurrenceSlots(
      { ...DEFAULT_OCCURRENCE, frequency: 'daily', interval: 3 },
      's1'
    )

    expect(slots.slotKeys).toEqual([0])
    expect(slots.labels).toEqual(['Every 3 days'])
  })

  it('keys a monthly date rule by day of month, deduplicated and sorted', () => {
    const monthly: Occurrence = {
      ...DEFAULT_OCCURRENCE,
      frequency: 'monthly',
      interval: 2,
      monthly_mode: 'date_specific',
      date_specific_1: 15,
      date_specific_2: 1,
    }

    const slots = occurrenceSlots(monthly, 's1')
    expect(slots.labels).toEqual(['Day 1', 'Day 15'])
    expect(slots.slotKeys).toEqual([2000, 2014])

    expect(
      occurrenceSlots({ ...monthly, date_specific_2: 15 }, 's1').slotKeys
    ).toEqual([2014])
  })

  it('keys a day-position rule by position and weekday', () => {
    const slots = occurrenceSlots(
      {
        ...DEFAULT_OCCURRENCE,
        frequency: 'monthly',
        interval: 1,
        monthly_mode: 'day_position',
        day_position_rules: [{ position: 2, weekday: 'mon' }],
      },
      's1'
    )

    expect(slots.labels).toEqual(['2nd Mon'])
    expect(slots.slotKeys).toEqual([3007])
  })

  it('keeps weekly, monthly and daily keys in separate ranges', () => {
    const weekly = occurrenceSlots(DEFAULT_OCCURRENCE, 's1').slotKeys
    const monthly = occurrenceSlots(
      {
        ...DEFAULT_OCCURRENCE,
        frequency: 'monthly',
        monthly_mode: 'day_month',
        day_of_month: 1,
      },
      's1'
    ).slotKeys

    expect(weekly.some((key) => monthly.includes(key))).toBe(false)
  })

  it('has slots but nothing to staff without a shift', () => {
    const slots = occurrenceSlots(DEFAULT_OCCURRENCE, undefined)

    expect(slots.pattern).toEqual([])
    expect(slots.slotKeys).toHaveLength(5)
  })
})
