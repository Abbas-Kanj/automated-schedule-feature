import { describe, expect, it } from 'vitest'
import { type Shift } from '@/features/shifts/data/schema'
import { buildDefaultDays } from '@/features/shifts/utils'
import {
  cellsFromPlacements,
  crewKeysFromDayCoverage,
  crewsFromDayCoverage,
  orderShiftIdsByStart,
  patternToSlots,
} from './rotation-crews'
import { type CrewPlacement } from './rotation-suggestion'

function makeShift(id: string, name: string, from: string, to: string): Shift {
  return {
    id,
    name,
    short_code: id.slice(0, 6).toUpperCase(),
    badge_color: 'blue',
    icon: 'clock',
    shift_type: 'fixed',
    category: 'regular',
    custom_category: undefined,
    timezone_mode: 'local',
    timezone: undefined,
    hours_mode: 'same',
    days: buildDefaultDays(
      { from_time: from, to_time: to, overnight: false },
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
  }
}

const morning = makeShift('s-morning', 'Morning', '06:00', '14:00')
const afternoon = makeShift('s-afternoon', 'Afternoon', '14:00', '22:00')
const night = makeShift('s-night', 'Night', '22:00', '23:59')
const shifts = [night, morning, afternoon]

describe('orderShiftIdsByStart', () => {
  it('orders by clock, not by the order they were selected', () => {
    expect(
      orderShiftIdsByStart(['s-night', 's-afternoon', 's-morning'], shifts)
    ).toEqual(['s-morning', 's-afternoon', 's-night'])
  })

  it('keeps an id whose shift is gone, at the end', () => {
    expect(orderShiftIdsByStart(['s-gone', 's-morning'], shifts)).toEqual([
      's-morning',
      's-gone',
    ])
  })

  it('sorts a shift with no enabled day last rather than first', () => {
    const unconfigured: Shift = {
      ...makeShift('s-blank', 'Blank', '00:00', '01:00'),
      days: buildDefaultDays(
        { from_time: '00:00', to_time: '01:00', overnight: false },
        false
      ),
    }
    expect(
      orderShiftIdsByStart(['s-blank', 's-night'], [...shifts, unconfigured])
    ).toEqual(['s-night', 's-blank'])
  })
})

describe('cellsFromPlacements', () => {
  const slots = patternToSlots([
    { position: 1, shift_id: 's-morning', is_off: false },
    { position: 2, shift_id: 's-morning', is_off: false },
    { position: 3, is_off: true },
  ])
  const orderedShiftIds = ['s-morning', 's-night']

  it('writes one cell per worked (day, shift) and nothing for rest days', () => {
    const placements: CrewPlacement[] = [
      {
        crew: { key: 'team:t1', kind: 'team', label: 'A', employeeIds: ['e1'] },
        dayOffset: 0,
        shiftStep: 0,
      },
      {
        crew: {
          key: 'employee:e2',
          kind: 'employee',
          label: 'B',
          employeeIds: ['e2'],
        },
        dayOffset: 0,
        shiftStep: 1,
      },
    ]

    const cells = cellsFromPlacements(slots, placements, orderedShiftIds)

    // Both crews work days 0 and 1 and rest on day 2 — one on Morning, the
    // other transposed onto Night.
    expect(cells).toEqual([
      { day: 0, shift_id: 's-morning', employee_ids: [], team_ids: ['t1'] },
      { day: 0, shift_id: 's-night', employee_ids: ['e2'], team_ids: [] },
      { day: 1, shift_id: 's-morning', employee_ids: [], team_ids: ['t1'] },
      { day: 1, shift_id: 's-night', employee_ids: ['e2'], team_ids: [] },
    ])
  })

  it('round-trips back through crewsFromDayCoverage', () => {
    const placements: CrewPlacement[] = [
      {
        crew: { key: 'team:t1', kind: 'team', label: 'A', employeeIds: ['e1'] },
        dayOffset: 0,
        shiftStep: 0,
      },
    ]
    const cells = cellsFromPlacements(slots, placements, orderedShiftIds)
    const crews = crewsFromDayCoverage(
      cells,
      [{ id: 't1', name: 'A', employee_ids: ['e1'] }],
      new Map()
    )

    expect(crews).toHaveLength(1)
    expect([...crews[0].byDay.entries()]).toEqual([
      [0, ['s-morning']],
      [1, ['s-morning']],
    ])
    expect(crewKeysFromDayCoverage(cells)).toEqual(['team:t1'])
  })

  it('drops a team or employee the stores no longer know about', () => {
    const crews = crewsFromDayCoverage(
      [
        {
          day: 0,
          shift_id: 's-morning',
          employee_ids: ['gone'],
          team_ids: ['also-gone'],
        },
      ],
      [],
      new Map()
    )
    expect(crews).toEqual([])
  })
})
