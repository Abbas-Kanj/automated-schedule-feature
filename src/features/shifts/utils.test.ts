import { describe, expect, it } from 'vitest'
import { emptyShiftFormValues } from './data/defaults'
import { type ShiftFormValues } from './data/schema'
import {
  buildDefaultDays,
  calculateShiftHours,
  deriveShortCode,
  formatDurationHM,
  formatDurationHours,
  getBreakSpanMinutes,
  getShiftTimeRange,
  normalizeShiftFormValues,
  parseDurationHM,
} from './utils'

describe('deriveShortCode', () => {
  it('uses the first six letters of a single word', () => {
    expect(deriveShortCode('  Morning ')).toBe('MORNIN')
    expect(deriveShortCode('On')).toBe('ON')
  })

  it('uses initials for several words, capped at six', () => {
    expect(deriveShortCode('night shift crew')).toBe('NSC')
    expect(deriveShortCode('a b c d e f g h')).toBe('ABCDEF')
  })

  it('is empty for a blank name', () => {
    expect(deriveShortCode('   ')).toBe('')
  })
})

describe('calculateShiftHours', () => {
  it('measures a same-day range', () => {
    expect(calculateShiftHours('09:00', '17:00')).toBe(8)
    expect(calculateShiftHours('09:00', '17:30')).toBe(8.5)
  })

  it('wraps a range that ends before it starts past midnight', () => {
    expect(calculateShiftHours('22:00', '06:00')).toBe(8)
  })

  it('is zero when either end is missing', () => {
    expect(calculateShiftHours('', '17:00')).toBe(0)
    expect(calculateShiftHours('09:00', '')).toBe(0)
  })
})

describe('formatDurationHours', () => {
  it('omits zero minutes', () => {
    expect(formatDurationHours(8)).toBe('8h')
  })

  it('shows leftover minutes', () => {
    expect(formatDurationHours(8.5)).toBe('8h 30m')
    expect(formatDurationHours(0.25)).toBe('0h 15m')
  })
})

describe('getBreakSpanMinutes', () => {
  it('measures a valid break', () => {
    expect(getBreakSpanMinutes('12:00', '12:45')).toBe(45)
  })

  it('is zero for an empty, reversed or zero-length range', () => {
    expect(getBreakSpanMinutes('', '12:45')).toBe(0)
    expect(getBreakSpanMinutes('13:00', '12:00')).toBe(0)
    expect(getBreakSpanMinutes('12:00', '12:00')).toBe(0)
  })
})

describe('formatDurationHM / parseDurationHM', () => {
  it('formats minutes as H:MM', () => {
    expect(formatDurationHM(90)).toBe('1:30')
    expect(formatDurationHM(5)).toBe('0:05')
  })

  it('parses complete H:MM strings', () => {
    expect(parseDurationHM('1:30')).toBe(90)
    expect(parseDurationHM(' 2:05 ')).toBe(125)
    expect(parseDurationHM('0:5')).toBe(5)
  })

  it('rejects partial or out-of-range input', () => {
    expect(parseDurationHM('1:')).toBeUndefined()
    expect(parseDurationHM('1:60')).toBeUndefined()
    expect(parseDurationHM('abc')).toBeUndefined()
  })

  it('round-trips', () => {
    for (const minutes of [0, 7, 60, 135, 600]) {
      expect(parseDurationHM(formatDurationHM(minutes))).toBe(minutes)
    }
  })
})

describe('buildDefaultDays', () => {
  const time = { from_time: '09:00', to_time: '17:00', overnight: false }

  it('builds all seven days with the given time and enabled state', () => {
    const days = buildDefaultDays(time, false)
    expect(days).toHaveLength(7)
    expect(days.every((d) => !d.enabled)).toBe(true)
    expect(days[0].times).toEqual([time])
  })

  it('gives every day its own time object', () => {
    const days = buildDefaultDays(time)
    days[0].times[0].from_time = '06:00'
    expect(days[1].times[0].from_time).toBe('09:00')
    expect(time.from_time).toBe('09:00')
  })
})

describe('getShiftTimeRange', () => {
  const baseDays = () =>
    buildDefaultDays({ from_time: '09:00', to_time: '17:00', overnight: false })

  it('is null when no day is enabled', () => {
    const days = baseDays().map((d) => ({ ...d, enabled: false }))
    expect(getShiftTimeRange(days)).toBeNull()
  })

  it('spans the earliest start to the latest end of enabled days only', () => {
    const days = baseDays()
    days[1].times = [
      { ...days[1].times[0], from_time: '07:00', to_time: '11:00' },
      { ...days[1].times[0], from_time: '13:00', to_time: '19:00' },
    ]
    days[2] = {
      ...days[2],
      enabled: false,
      times: [{ ...days[2].times[0], from_time: '05:00', to_time: '23:00' }],
    }
    expect(getShiftTimeRange(days)).toEqual({
      from_time: '07:00',
      to_time: '19:00',
    })
  })
})

describe('normalizeShiftFormValues', () => {
  const stale: ShiftFormValues = {
    ...emptyShiftFormValues,
    timezone_mode: 'local',
    timezone: 'Asia/Beirut',
    category: 'regular',
    custom_category: 'Stale',
    repeat_enabled: false,
    repeat: { frequency: 'weekly' } as ShiftFormValues['repeat'],
    break_enabled: false,
    breaks: [{} as ShiftFormValues['breaks'][number]],
    assign_to_enabled: false,
    work_type_group: 'wtg',
    service_resource: 'sr',
    service_territory: 'st',
    employee_ids: ['emp-1'],
    team_ids: ['team-1'],
  }

  it('clears every field whose toggle is off', () => {
    const result = normalizeShiftFormValues(stale)
    expect(result.timezone).toBeUndefined()
    expect(result.custom_category).toBeUndefined()
    expect(result.repeat).toEqual({})
    expect(result.breaks).toEqual([])
    expect(result.work_type_group).toBeUndefined()
    expect(result.service_resource).toBeUndefined()
    expect(result.service_territory).toBeUndefined()
    expect(result.employee_ids).toEqual([])
    expect(result.team_ids).toEqual([])
  })

  it('keeps those fields when their toggles are on', () => {
    const result = normalizeShiftFormValues({
      ...stale,
      timezone_mode: 'global',
      category: 'custom',
      repeat_enabled: true,
      break_enabled: true,
      assign_to_enabled: true,
    })
    expect(result.timezone).toBe('Asia/Beirut')
    expect(result.custom_category).toBe('Stale')
    expect(result.repeat).toEqual(stale.repeat)
    expect(result.breaks).toEqual(stale.breaks)
    expect(result.work_type_group).toBe('wtg')
    expect(result.employee_ids).toEqual(['emp-1'])
    expect(result.team_ids).toEqual(['team-1'])
  })
})
