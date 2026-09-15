import { describe, expect, it } from 'vitest'
import { type Shift } from '@/features/shifts/data/schema'
import { buildDefaultDays } from '@/features/shifts/utils'
import { type Schedule } from './data/schema'
import {
  type CalendarScheduleInput,
  calculateHours,
  deriveShortCode,
  describeStartDay,
  formatTimes,
  getDaysInMonthArray,
  getDaysOfMonth,
  getScheduleCalendarCycle,
  getScheduleCycleLength,
  getScheduleSummary,
  getScheduleTotalHours,
} from './utils'

function makeShift(
  overrides: Partial<Shift> & Pick<Shift, 'id' | 'name'>
): Shift {
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
    // A stored shift is always fully configured, unlike a blank in-progress
    // form — default every fixture shift to enabled all week.
    days: buildDefaultDays(
      { from_time: '09:00', to_time: '17:00', overnight: false },
      true
    ),
    break_enabled: false,
    breaks: [],
    description: undefined,
    is_active: true,
    policy_ids: [],
    status: 'confirmed',
    time_slot_type: 'regular',
    repeat_enabled: false,
    repeat: {},
    assign_to_enabled: false,
    work_type_group: undefined,
    service_resource: undefined,
    service_territory: undefined,
    employee_ids: [],
    team_ids: [],
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
    days: buildDefaultDays(
      { from_time: '09:00', to_time: '17:00', overnight: false },
      false
    ).map((d) => ({ ...d, enabled: d.day !== 'sat' && d.day !== 'sun' })),
  })

  const schedule: CalendarScheduleInput = {
    type: 'fixed',
    start_date: '2026-01-05', // Monday
    shift_ids: ['weekdays'],
  }

  it("is active on the shift's own enabled weekdays and off on the rest", () => {
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
      days: buildDefaultDays(
        { from_time: '18:00', to_time: '22:00', overnight: false },
        true
      ),
    })
    const cycle = getScheduleCalendarCycle(
      { ...schedule, shift_ids: ['weekdays', 'evenings'] },
      [weekdayShift, eveningShift],
      0
    )
    const monday = cycle.days.find((d) => d.date_str === '2026-01-05')
    expect(monday?.entries.map((e) => e.shift.id)).toEqual([
      'weekdays',
      'evenings',
    ])
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
    const withEnd = {
      ...base,
      end_settings: { end_type: 'after_occurrences', end_occurrences: 2 },
    }
    expect(
      getScheduleCalendarCycle(withEnd, [shiftA], 0).canGoToNextCycle
    ).toBe(true)
    expect(
      getScheduleCalendarCycle(withEnd, [shiftA], 1).canGoToNextCycle
    ).toBe(false)
  })

  it('on_date: stops once the next cycle would start past the end date', () => {
    const withEnd = {
      ...base,
      end_settings: { end_type: 'on_date', end_date: '2026-01-02' },
    }
    // cycle 0 is just 2026-01-01 (pattern length 1) — the next cycle would
    // start 2026-01-02, still within range.
    expect(
      getScheduleCalendarCycle(withEnd, [shiftA], 0).canGoToNextCycle
    ).toBe(true)
    // cycle 1 (2026-01-02) — the next cycle would start 2026-01-03, past it.
    expect(
      getScheduleCalendarCycle(withEnd, [shiftA], 1).canGoToNextCycle
    ).toBe(false)
  })
})

describe('getScheduleCalendarCycle — rotate custom_shifts follows plain pattern order', () => {
  const shiftA = makeShift({ id: 'a', name: 'Shift A' })
  const shiftB = makeShift({ id: 'b', name: 'Shift B' })

  // No `shift_repeat` at all, so every card falls through the "no matching
  // repeat rule" path: one card, one day, always active — the same
  // position-modulo mapping `pattern_shifts` uses. See the weekly-frequency
  // describe block below for the case where `shift_repeat` is present.
  const schedule: CalendarScheduleInput = {
    type: 'rotate',
    start_date: '2026-08-24', // Monday
    shift_ids: ['a', 'b'],
    pattern: [
      { position: 1, is_off: false, shift_id: 'a' },
      { position: 2, is_off: false, shift_id: 'b' },
      { position: 3, is_off: false, shift_id: 'b' },
      { position: 4, is_off: false, shift_id: 'a' },
    ],
  }

  it('shows Shift A, Shift B, Shift B, Shift A on consecutive days, in that exact order', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    expect(cycle.days.map((d) => d.date_str)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
    ])
    expect(cycle.days.map((d) => d.entries[0]?.shift.id)).toEqual([
      'a',
      'b',
      'b',
      'a',
    ])
  })
})

describe('getScheduleCalendarCycle — caps the rendered page at 28 days', () => {
  const shiftA = makeShift({ id: 'a', name: 'Shift A' })
  const shiftB = makeShift({ id: 'b', name: 'Shift B' })

  it('renders at most 28 days even for a much longer rotate pattern, while cycleLength stays the real length', () => {
    const pattern = Array.from({ length: 40 }, (_, i) => ({
      position: i + 1,
      is_off: false,
      shift_id: i % 2 === 0 ? 'a' : 'b',
    }))
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      start_date: '2026-08-24',
      shift_ids: ['a', 'b'],
      pattern,
    }
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    expect(cycle.days.length).toBe(28)
    expect(cycle.cycleLength).toBe(40)
  })
})

describe('getScheduleCalendarCycle — rotate custom_shifts, weekly frequency expands to a real week', () => {
  const shiftA = makeShift({ id: 'a', name: 'Shift A' })
  const shiftB = makeShift({ id: 'b', name: 'Shift B' })

  // Card counts match each shift's own repeat interval (2 A cards, 3 B
  // cards); each card spans a real 7-day week, active only on that shift's
  // own selected weekdays.
  const schedule: CalendarScheduleInput = {
    type: 'rotate',
    start_date: '2026-08-24', // Monday
    shift_ids: ['a', 'b'],
    pattern: [
      { position: 1, is_off: false, shift_id: 'b' },
      { position: 2, is_off: false, shift_id: 'a' },
      { position: 3, is_off: false, shift_id: 'b' },
      { position: 4, is_off: false, shift_id: 'a' },
      { position: 5, is_off: false, shift_id: 'b' },
    ],
    shift_repeat: [
      {
        shift_id: 'a',
        frequency: 'weekly',
        weekdays: ['mon', 'wed', 'fri', 'sat'],
      },
      { shift_id: 'b', frequency: 'weekly', weekdays: ['mon', 'fri'] },
    ],
  }

  it('follows each shift on its own selected weekdays for the duration of its card, in pattern order', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    const byDate = Object.fromEntries(cycle.days.map((d) => [d.date_str, d]))

    // Card 1 (Shift B, Mon/Fri) — 2026-08-24 (Mon) through 2026-08-30 (Sun).
    expect(byDate['2026-08-24'].entries[0]?.shift.id).toBe('b') // Mon
    expect(byDate['2026-08-25'].isOff).toBe(true) // Tue
    expect(byDate['2026-08-26'].isOff).toBe(true) // Wed
    expect(byDate['2026-08-27'].isOff).toBe(true) // Thu
    expect(byDate['2026-08-28'].entries[0]?.shift.id).toBe('b') // Fri
    expect(byDate['2026-08-29'].isOff).toBe(true) // Sat
    expect(byDate['2026-08-30'].isOff).toBe(true) // Sun

    // Card 2 (Shift A, Mon/Wed/Fri/Sat) — 2026-08-31 through 2026-09-06.
    expect(byDate['2026-08-31'].entries[0]?.shift.id).toBe('a') // Mon
    expect(byDate['2026-09-01'].isOff).toBe(true) // Tue
    expect(byDate['2026-09-02'].entries[0]?.shift.id).toBe('a') // Wed
    expect(byDate['2026-09-03'].isOff).toBe(true) // Thu
    expect(byDate['2026-09-04'].entries[0]?.shift.id).toBe('a') // Fri
    expect(byDate['2026-09-05'].entries[0]?.shift.id).toBe('a') // Sat
    expect(byDate['2026-09-06'].isOff).toBe(true) // Sun

    // Card 3 (Shift B again, Mon/Fri) — 2026-09-07 through 2026-09-13.
    expect(byDate['2026-09-07'].entries[0]?.shift.id).toBe('b') // Mon
    expect(byDate['2026-09-11'].entries[0]?.shift.id).toBe('b') // Fri
  })

  it('reports the real expanded day count as cycleLength, not the raw card count', () => {
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    // 5 cards x 7 real days each = 35, capped at 28 rendered days.
    expect(cycle.cycleLength).toBe(35)
    expect(cycle.days.length).toBe(28)
  })

  it("shows the shift's real per-weekday hours on a weekly-expanded active day, not a generic summary", () => {
    const preciseShiftA = makeShift({
      id: 'a',
      name: 'Shift A',
      days: shiftA.days.map((d) =>
        d.day === 'wed'
          ? {
              ...d,
              times: [
                { from_time: '06:00', to_time: '14:00', overnight: false },
              ],
            }
          : d
      ),
    })
    const cycle = getScheduleCalendarCycle(schedule, [preciseShiftA, shiftB], 0)
    const wednesday = cycle.days.find((d) => d.date_str === '2026-09-02')
    expect(wednesday?.entries[0]?.times).toEqual([
      { from_time: '06:00', to_time: '14:00', overnight: false },
    ])
  })
})

describe('getScheduleCalendarCycle — rotate custom_shifts, weekly card edge cases', () => {
  const shiftA = makeShift({ id: 'a', name: 'Shift A' })

  it('treats a weekly entry with no weekdays selected as fully off, without crashing', () => {
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      start_date: '2026-08-24', // Monday
      shift_ids: ['a'],
      pattern: [{ position: 1, is_off: false, shift_id: 'a' }],
      shift_repeat: [{ shift_id: 'a', frequency: 'weekly' }],
    }
    const cycle = getScheduleCalendarCycle(schedule, [shiftA], 0)
    expect(cycle.cycleLength).toBe(7)
    expect(cycle.days.every((d) => d.isOff)).toBe(true)
    expect(cycle.days.every((d) => d.entries.length === 0)).toBe(true)
  })

  it('resolves a weekly card referencing a deleted shift as off, not "active with no shift"', () => {
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      start_date: '2026-08-24', // Monday
      shift_ids: ['ghost'],
      pattern: [{ position: 1, is_off: false, shift_id: 'ghost' }],
      shift_repeat: [
        { shift_id: 'ghost', frequency: 'weekly', weekdays: ['mon'] },
      ],
    }
    // No shifts at all resolve — 'ghost' was deleted.
    const cycle = getScheduleCalendarCycle(schedule, [], 0)
    expect(cycle.days.every((d) => d.isOff)).toBe(true)
    expect(cycle.days.every((d) => d.entries.length === 0)).toBe(true)
  })

  it('leaves a daily-frequency card unaffected — still 1 day, always active', () => {
    const shiftB = makeShift({ id: 'b', name: 'Shift B' })
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      start_date: '2026-08-24', // Monday
      shift_ids: ['a', 'b'],
      pattern: [
        { position: 1, is_off: false, shift_id: 'a' },
        { position: 2, is_off: false, shift_id: 'a' },
        { position: 3, is_off: false, shift_id: 'b' },
      ],
      shift_repeat: [
        { shift_id: 'a', frequency: 'daily' },
        { shift_id: 'b', frequency: 'weekly', weekdays: ['wed'] },
      ],
    }
    const cycle = getScheduleCalendarCycle(schedule, [shiftA, shiftB], 0)
    // 2 daily cards (1 day each) + 1 weekly card (7 days) = 9.
    expect(cycle.cycleLength).toBe(9)
    const byDate = Object.fromEntries(cycle.days.map((d) => [d.date_str, d]))
    expect(byDate['2026-08-24'].entries[0]?.shift.id).toBe('a') // card 1 (Mon)
    expect(byDate['2026-08-25'].entries[0]?.shift.id).toBe('a') // card 2 (Tue)
    // Card 3 (weekly, Wed only) starts 2026-08-26 — which is itself a Wed.
    expect(byDate['2026-08-26'].entries[0]?.shift.id).toBe('b') // Wed — active
    expect(byDate['2026-08-27'].isOff).toBe(true) // Thu — off
    expect(byDate['2026-08-28'].isOff).toBe(true) // Fri — off
  })

  it('restarts the pattern from card 1 on the next cycle, real-day-aligned', () => {
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      start_date: '2026-08-24', // Monday
      shift_ids: ['a'],
      pattern: [{ position: 1, is_off: false, shift_id: 'a' }],
      shift_repeat: [
        { shift_id: 'a', frequency: 'weekly', weekdays: ['mon', 'wed'] },
      ],
    }
    const cycle0 = getScheduleCalendarCycle(schedule, [shiftA], 0)
    const cycle1 = getScheduleCalendarCycle(schedule, [shiftA], 1)
    expect(cycle0.days[0].date_str).toBe('2026-08-24')
    expect(cycle1.days[0].date_str).toBe('2026-08-31')
    // Same weekly card repeats identically on the next cycle.
    expect(cycle0.days.map((d) => d.isOff)).toEqual(
      cycle1.days.map((d) => d.isOff)
    )
  })
})

describe('getScheduleCycleLength — rotate custom_shifts', () => {
  it('counts a weekly-frequency card as 7 real days, not 1', () => {
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      pattern: [
        { position: 1, is_off: false, shift_id: 'a' },
        { position: 2, is_off: false, shift_id: 'b' },
      ],
      shift_repeat: [
        { shift_id: 'a', frequency: 'weekly', weekdays: ['mon'] },
        { shift_id: 'b', frequency: 'daily' },
      ],
    }
    expect(getScheduleCycleLength(schedule)).toBe(8) // 7 (weekly) + 1 (daily)
  })

  it('matches the raw pattern length when no shift_repeat is given (pattern_shifts mode)', () => {
    const schedule: CalendarScheduleInput = {
      type: 'rotate',
      pattern: [
        { position: 1, is_off: false, shift_id: 'a' },
        { position: 2, is_off: true },
      ],
    }
    expect(getScheduleCycleLength(schedule)).toBe(2)
  })
})

describe('calculateHours', () => {
  it('adds up a day of ranges to two decimal places', () => {
    expect(
      calculateHours([
        { from_time: '09:00', to_time: '12:30' },
        { from_time: '13:15', to_time: '17:00' },
      ])
    ).toBe(7.25)
  })

  // Naive subtraction gives a plausible but wrong-by-24h answer here.
  it('reads a range that ends before it starts as crossing midnight', () => {
    expect(calculateHours([{ from_time: '22:00', to_time: '06:00' }])).toBe(8)
  })

  it('skips an incomplete range rather than counting it as zero-length', () => {
    expect(
      calculateHours([
        { from_time: '', to_time: '17:00' },
        { from_time: '09:00', to_time: '17:00' },
      ])
    ).toBe(8)
  })

  it('is 0 for no ranges at all', () => {
    expect(calculateHours([])).toBe(0)
  })
})

describe('deriveShortCode', () => {
  it('takes the initials of a multi-word name', () => {
    expect(deriveShortCode('Night Shift Crew')).toBe('NSC')
  })

  it('takes the first six characters of a single word', () => {
    expect(deriveShortCode('Maintenance')).toBe('MAINTE')
  })

  it('caps initials at six characters', () => {
    expect(deriveShortCode('a b c d e f g h')).toBe('ABCDEF')
  })

  it('is empty for a blank name', () => {
    expect(deriveShortCode('   ')).toBe('')
  })
})

describe('formatTimes', () => {
  const identity = (time: string) => time

  it('joins every range with the caller’s own clock formatter', () => {
    expect(
      formatTimes(
        [
          { from_time: '09:00', to_time: '17:00' },
          { from_time: '18:00', to_time: '20:00' },
        ],
        identity
      )
    ).toBe('09:00–17:00, 18:00–20:00')
  })

  it('is a dash when there is nothing to show', () => {
    expect(formatTimes([], identity)).toBe('—')
    expect(formatTimes(undefined, identity)).toBe('—')
  })
})

describe('describeStartDay', () => {
  // "Week 2" is the phrase the real-world rotation write-ups use, so a cycle
  // that is a whole number of weeks says it out loud.
  it('names the week on a whole-week cycle', () => {
    expect(describeStartDay(7, 28)).toBe('Day 8 · week 2')
    expect(describeStartDay(0, 28)).toBe('Day 1 · week 1')
  })

  it('gives a plain day number when the cycle is not whole weeks', () => {
    expect(describeStartDay(3, 10)).toBe('Day 4')
  })

  // Exactly one week is still a single week, so the suffix says nothing.
  it('leaves a seven-day cycle as plain days', () => {
    expect(describeStartDay(3, 7)).toBe('Day 4')
  })
})

describe('getDaysOfMonth', () => {
  it('returns every day of the month with its weekday', () => {
    const days = getDaysOfMonth(2026, 2)
    expect(days).toHaveLength(28)
    expect(days[0].date_str).toBe('2026-02-01')
    expect(days[0].weekday).toBe('sunday')
    expect(days[27].date_str).toBe('2026-02-28')
  })

  it('counts a leap February', () => {
    expect(getDaysOfMonth(2028, 2)).toHaveLength(29)
    expect(getDaysInMonthArray(2028, 2)).toHaveLength(29)
  })

  it('numbers days from 1', () => {
    expect(getDaysInMonthArray(2026, 4)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1)
    )
  })
})

describe('getScheduleTotalHours', () => {
  const morning = makeShift({ id: 'shift-morning', name: 'Morning' })

  const fixedSchedule = {
    id: 'sched-1',
    name: 'Fixed',
    description: '',
    parent_type: 'regular',
    type: 'fixed',
    shift_ids: ['shift-morning'],
    temporary_schedule: false,
    start_date: '2026-01-05',
    end_settings: { end_type: 'never' },
  } as unknown as Schedule

  it('adds every enabled day of every selected shift for fixed', () => {
    // 8 hours a day, enabled all seven days.
    expect(getScheduleTotalHours(fixedSchedule, [morning])).toBe(56)
  })

  it('ignores a shift id with no shift behind it', () => {
    expect(getScheduleTotalHours(fixedSchedule, [])).toBe(0)
  })

  it('averages a rotate pattern over its cycle length', () => {
    const rotateSchedule = {
      id: 'sched-2',
      name: 'Rotate',
      description: '',
      parent_type: 'regular',
      type: 'rotate',
      shift_ids: ['shift-morning'],
      temporary_schedule: false,
      start_date: '2026-01-05',
      end_settings: { end_type: 'never' },
      cycle_type: 'pattern_shifts',
      cycle_length: { unit: 'custom_days', days: 2 },
      pattern: [
        { position: 1, shift_id: 'shift-morning', is_off: false },
        { position: 2, is_off: true },
      ],
      shift_repeat: [],
      day_coverage: [],
      crew_placements: [],
    } as unknown as Schedule

    // One working card worth 56, spread over a two-day cycle.
    expect(getScheduleTotalHours(rotateSchedule, [morning])).toBe(28)
  })
})

describe('getScheduleSummary', () => {
  const morning = makeShift({ id: 'shift-morning', name: 'Morning' })

  it('counts shifts and their enabled days for fixed', () => {
    const schedule = {
      id: 'sched-1',
      name: 'Fixed',
      description: '',
      parent_type: 'regular',
      type: 'fixed',
      shift_ids: ['shift-morning'],
      temporary_schedule: false,
      start_date: '2026-01-05',
      end_settings: { end_type: 'never' },
    } as unknown as Schedule

    expect(getScheduleSummary(schedule, [morning])).toBe('1 shift · 7 days')
  })

  it('names the cycle for rotate', () => {
    const schedule = {
      id: 'sched-2',
      name: 'Rotate',
      description: '',
      parent_type: 'regular',
      type: 'rotate',
      shift_ids: ['shift-morning', 'shift-night'],
      temporary_schedule: false,
      start_date: '2026-01-05',
      end_settings: { end_type: 'never' },
      cycle_type: 'pattern_shifts',
      cycle_length: { unit: 'custom_days', days: 14 },
      pattern: [],
      shift_repeat: [],
      day_coverage: [],
      crew_placements: [],
    } as unknown as Schedule

    expect(getScheduleSummary(schedule, [morning])).toContain('14-day cycle')
  })

  it('lists the weekdays for a weekly_one schedule', () => {
    const schedule = {
      id: 'sched-3',
      name: 'Weekly',
      description: '',
      parent_type: 'daily',
      type: 'weekly_one',
      days: [
        { day: 'monday', times: [{ from_time: '09:00', to_time: '17:00' }] },
        { day: 'friday', times: [{ from_time: '09:00', to_time: '17:00' }] },
      ],
      employees: [{ value: 'emp-a', label: 'Amir' }],
    } as unknown as Schedule

    expect(getScheduleSummary(schedule, [])).toBe('Monday, Friday · 2 days')
  })
})
