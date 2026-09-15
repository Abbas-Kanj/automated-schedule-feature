import { describe, expect, it } from 'vitest'
import { type Shift } from '@/features/shifts/data/schema'
import { buildDefaultDays } from '@/features/shifts/utils'
import { type RotateCrewPlacement } from './data/schema'
import {
  cellsFromCrewPlacements,
  cellsFromPlacements,
  crewKeysFromDayCoverage,
  crewPlacementsToStored,
  crewsFromDayCoverage,
  dayCoverageMatchesPlacements,
  orderShiftIdsByStart,
  patternToSlots,
  shiftHoursById,
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

// The start days a rotation is written in — "Team B starts week 2" — live
// next to the matrix rather than instead of it, so the pair has to stay
// honest about whether one still describes the other.
describe('crew placements alongside the matrix', () => {
  const orderedShiftIds = ['s-morning', 's-afternoon']
  // Five on, two off — two crews, one on each shift, is the case the
  // shift-step idea exists for.
  const slots = patternToSlots(
    Array.from({ length: 7 }, (_, i) => ({
      position: i + 1,
      shift_id: i < 5 ? 's-morning' : undefined,
      is_off: i >= 5,
    }))
  )

  const placements: RotateCrewPlacement[] = [
    { crew: 'team:a', day_offset: 0, shift_step: 0 },
    { crew: 'team:b', day_offset: 0, shift_step: 1 },
  ]

  it('rebuilds the same matrix the search would have written', () => {
    const fromStored = cellsFromCrewPlacements(
      slots,
      placements,
      orderedShiftIds
    )
    const fromSearch = cellsFromPlacements(
      slots,
      placements.map<CrewPlacement>((placement) => ({
        crew: {
          key: placement.crew,
          kind: 'team',
          label: placement.crew,
          employeeIds: [],
        },
        dayOffset: placement.day_offset,
        shiftStep: placement.shift_step,
      })),
      orderedShiftIds
    )

    expect(fromStored).toEqual(fromSearch)
    // Both shifts staffed on all five working days: the second crew is
    // transposed, not re-carded.
    expect(fromStored).toHaveLength(10)
  })

  it('round-trips the search’s own placements through storage', () => {
    const stored = crewPlacementsToStored([
      {
        crew: {
          key: 'employee:e1',
          kind: 'employee',
          label: 'E1',
          employeeIds: ['e1'],
        },
        dayOffset: 3,
        shiftStep: 1,
      },
    ])

    expect(stored).toEqual([
      { crew: 'employee:e1', day_offset: 3, shift_step: 1 },
    ])
    expect(
      cellsFromCrewPlacements(slots, stored, orderedShiftIds)[0].employee_ids
    ).toEqual(['e1'])
  })

  it('says the placements describe the matrix they generated', () => {
    const cells = cellsFromCrewPlacements(slots, placements, orderedShiftIds)
    expect(
      dayCoverageMatchesPlacements(slots, placements, orderedShiftIds, cells)
    ).toBe(true)
  })

  // One cell moved by hand is a roster no pair of offsets can describe, so
  // every screen showing "each crew a week apart" has to stop saying so.
  it('stops describing it once a single cell is edited by hand', () => {
    const cells = cellsFromCrewPlacements(slots, placements, orderedShiftIds)
    const edited = cells.filter(
      (cell) => !(cell.day === 2 && cell.shift_id === 's-afternoon')
    )

    expect(edited).toHaveLength(cells.length - 1)
    expect(
      dayCoverageMatchesPlacements(slots, placements, orderedShiftIds, edited)
    ).toBe(false)
  })

  it('never claims to describe a matrix when there are no placements', () => {
    const cells = cellsFromCrewPlacements(slots, placements, orderedShiftIds)
    expect(
      dayCoverageMatchesPlacements(slots, [], orderedShiftIds, cells)
    ).toBe(false)
  })
})

describe('shiftHoursById', () => {
  it('reads a daytime shift straight off the clock', () => {
    expect(shiftHoursById([morning]).get('s-morning')).toEqual({
      startMinutes: 6 * 60,
      endMinutes: 14 * 60,
    })
  })

  // A night ending at 06:00 has to end *after* it starts, or the rest
  // arithmetic against the next morning goes negative instead of zero.
  it('pushes an overnight shift’s end into the next day', () => {
    const overnight = makeShift('s-on', 'Overnight', '22:00', '06:00')
    expect(shiftHoursById([overnight]).get('s-on')).toEqual({
      startMinutes: 22 * 60,
      endMinutes: 6 * 60 + 1440,
    })
  })

  it('leaves out a shift with no enabled day rather than inventing hours', () => {
    const blank: Shift = {
      ...makeShift('s-blank', 'Blank', '09:00', '17:00'),
      days: buildDefaultDays(
        { from_time: '09:00', to_time: '17:00', overnight: false },
        false
      ),
    }
    expect(shiftHoursById([blank]).has('s-blank')).toBe(false)
  })
})

describe('patternToSlots', () => {
  it('re-indexes the 1-based pattern onto 0-based slots', () => {
    expect(
      patternToSlots([
        { position: 1, shift_id: 's-morning', is_off: false },
        { position: 2, is_off: true },
      ])
    ).toEqual([
      { index: 0, shiftId: 's-morning', isOff: false },
      { index: 1, shiftId: undefined, isOff: true },
    ])
  })

  // A card marked working but naming no shift can't staff anything, so it
  // has to read as off.
  it('treats a working card with no shift as a rest card', () => {
    expect(patternToSlots([{ position: 1, is_off: false }])).toEqual([
      { index: 0, shiftId: undefined, isOff: true },
    ])
  })

  it('is empty for an empty pattern', () => {
    expect(patternToSlots([])).toEqual([])
  })
})

describe('crewKeysFromDayCoverage', () => {
  it('collects both kinds of crew, each once, however many cells it is on', () => {
    const keys = crewKeysFromDayCoverage([
      {
        day: 0,
        shift_id: 's-morning',
        employee_ids: ['emp-a'],
        team_ids: ['team-1'],
      },
      {
        day: 1,
        shift_id: 's-night',
        employee_ids: ['emp-a', 'emp-b'],
        team_ids: ['team-1'],
      },
    ])

    expect(new Set(keys)).toEqual(
      new Set(['team:team-1', 'employee:emp-a', 'employee:emp-b'])
    )
    expect(keys).toHaveLength(3)
  })

  it('is empty for an empty matrix', () => {
    expect(crewKeysFromDayCoverage([])).toEqual([])
  })
})
