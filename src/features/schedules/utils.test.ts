import { describe, expect, it } from 'vitest'
import { type Shift } from '@/features/shifts/data/schema'
import { buildDefaultDays } from '@/features/shifts/utils'
import {
  type CalendarScheduleInput,
  getScheduleCalendarCycle,
  getScheduleCycleLength,
} from './utils'

function makeShift(overrides: Partial<Shift> & Pick<Shift, 'id' | 'name'>): Shift {
  return {
    short_code: overrides.id.slice(0, 6).toUpperCase(),
    badge_color: 'blue',
    icon: 'clock',
    shift_type: 'fixed',
    category: 'regular',
    custom_category: undefined,
    timezone_mode: 'local',
    timezone: undefined,
    hours_mode: 'same',
    // A shift actually sitting in the store is always fully configured
    // (unlike `emptyShiftFormValues`'s blank in-progress form, whose days
    // all start disabled) — default every fixture shift to enabled all
    // week, same as `getShiftTimeRange`'s real callers expect.
    days: buildDefaultDays({ from_time: '09:00', to_time: '17:00', overnight: false }, true),
    break_enabled: false,
    breaks: [],
    description: undefined,
    is_active: true,
    policy_type: undefined,
    status: 'confirmed',
    time_slot_type: 'regular',
    repeat_enabled: false,
    repeat: {},
    assign_to_enabled: false,
    work_type_group: undefined,
    service_resource: undefined,
    service_territory: undefined,
    ...overrides,
  }
}

describe('getScheduleCycleLength', () => {
  it("is the pattern's own length for rotate", () => {
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      pattern: [
        { position: 1, is_off: false, shift_id: 'a' },
        { position: 2, is_off: true },
        { position: 3, is_off: false, shift_id: 'b' },
      ],
    }
    expect(getScheduleCycleLength(schedule)).toBe(3)
  })

  it('is always 7 for fixed/flexible', () => {
    expect(getScheduleCycleLength({ type: 'fixed' })).toBe(7)
    expect(getScheduleCycleLength({ type: 'flexible' })).toBe(7)
  })
})

describe('getScheduleCalendarCycle — rotate', () => {
  const shiftA = makeShift({ id: 'a', name: 'Morning' })
  const shiftB = makeShift({ id: 'b', name: 'Night' })
  const schedule: CalendarScheduleInput = {
    type: 'rotate',
    start_date: '2026-01-01', // Thursday
    pattern: [
      { position: 1, is_off: false, shift_id: 'a' },
      { position: 2, is_off: true },
      { position: 3, is_off: false, shift_id: 'b' },
    ],
  }

  it('maps cycle 0 onto the pattern in order starting at start_date', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    expect(cycle.days.map((d) => d.date_str)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
    expect(cycle.days[0].isOff).toBe(false)
    expect(cycle.days[0].entries[0]?.shift.id).toBe('a')
    expect(cycle.days[1].isOff).toBe(true)
    expect(cycle.days[1].entries).toEqual([])
    expect(cycle.days[2].isOff).toBe(false)
    expect(cycle.days[2].entries[0]?.shift.id).toBe('b')
  })

  it('wraps the pattern (mod cycle length) on the next cycle', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 1)
    expect(cycle.days.map((d) => d.date_str)).toEqual([
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
    ])
    // Same 3-position pattern repeats: shift a, off, shift b.
    expect(cycle.days[0].entries[0]?.shift.id).toBe('a')
    expect(cycle.days[1].isOff).toBe(true)
    expect(cycle.days[2].entries[0]?.shift.id).toBe('b')
  })

  it('never pages before start_date', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    expect(cycle.canGoToPreviousCycle).toBe(false)
    const nextCycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 1)
    expect(nextCycle.canGoToPreviousCycle).toBe(true)
  })

  it('reads a Monday-first weekday index (Thursday = 3)', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    expect(cycle.days[0].weekdayIndex).toBe(3)
  })
})

describe('getScheduleCalendarCycle — fixed/flexible', () => {
  const weekdayShift = makeShift({
    id: 'weekdays',
    name: 'Weekdays',
    days: buildDefaultDays({ from_time: '09:00', to_time: '17:00', overnight: false }, false).map(
      (d) => ({ ...d, enabled: d.day !== 'sat' && d.day !== 'sun' })
    ),
  })

  const schedule: CalendarScheduleInput = {
    type: 'fixed',
    start_date: '2026-01-05', // Monday
    shift_ids: ['weekdays'],
  }

  it('is active on the shift\'s own enabled weekdays and off on the rest', () => {
    const cycle = getScheduleCalendarCycle(schedule, [weekdayShift], 0)
    expect(cycle.days).toHaveLength(7)
    const byDate = Object.fromEntries(cycle.days.map((d) => [d.date_str, d]))

    expect(byDate['2026-01-05'].isOff).toBe(false) // Mon
    expect(byDate['2026-01-05'].entries[0]?.times).toEqual([
      { from_time: '09:00', to_time: '17:00', overnight: false },
    ])
    expect(byDate['2026-01-09'].isOff).toBe(false) // Fri
    expect(byDate['2026-01-10'].isOff).toBe(true) // Sat
    expect(byDate['2026-01-11'].isOff).toBe(true) // Sun
  })

  it('stacks more than one shift active on the same day', () => {
    const eveningShift = makeShift({
      id: 'evenings',
      name: 'Evenings',
      days: buildDefaultDays({ from_time: '18:00', to_time: '22:00', overnight: false }, true),
    })
    const cycle = getScheduleCalendarCycle(
      { ...schedule, shift_ids: ['weekdays', 'evenings'] },
      [weekdayShift, eveningShift],
      0
    )
    const monday = cycle.days.find((d) => d.date_str === '2026-01-05')
    expect(monday?.entries.map((e) => e.shift.id)).toEqual(['weekdays', 'evenings'])
  })
})

describe('getScheduleCalendarCycle — end_settings capping', () => {
  const shiftA = makeShift({ id: 'a', name: 'Morning' })
  const base: CalendarScheduleInput = {
    type: 'rotate',
    start_date: '2026-01-01',
    pattern: [{ position: 1, is_off: false, shift_id: 'a' }],
  }

  it('never ends: always allows the next cycle', () => {
    const cycle = getScheduleCalendarCycle(
      { ...base, end_settings: { end_type: 'never' } },
      [shiftA],
      5
    )
    expect(cycle.canGoToNextCycle).toBe(true)
  })

  it('after_occurrences: stops once cycleIndex reaches the occurrence count', () => {
    const withEnd = { ...base, end_settings: { end_type: 'after_occurrences', end_occurrences: 2 } }
    expect(getScheduleCalendarCycle(withEnd, [shiftA], 0).canGoToNextCycle).toBe(true)
    expect(getScheduleCalendarCycle(withEnd, [shiftA], 1).canGoToNextCycle).toBe(false)
  })

  it('on_date: stops once the next cycle would start past the end date', () => {
    const withEnd = { ...base, end_settings: { end_type: 'on_date', end_date: '2026-01-02' } }
    // cycle 0 is just 2026-01-01 (pattern length 1) — the next cycle would
    // start 2026-01-02, still within range.
    expect(getScheduleCalendarCycle(withEnd, [shiftA], 0).canGoToNextCycle).toBe(true)
    // cycle 1 (2026-01-02) — the next cycle would start 2026-01-03, past it.
    expect(getScheduleCalendarCycle(withEnd, [shiftA], 1).canGoToNextCycle).toBe(false)
  })
})
