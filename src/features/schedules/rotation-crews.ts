// Bridges a rotate schedule's stored data and the schema-free model
// `rotation-suggestion.ts` reasons in: `day_coverage` (the stored matrix)
// becomes `CoverageCrew[]` for grading, and search placements become
// `day_coverage` cells. Also owns the shift *order* the suggestion treats as
// given — clock order, earliest start first, so stepping one along moves
// forward through the day rather than backwards into a night.
import { toMinutes } from '@/lib/time'
import { type Shift } from '@/features/shifts/data/schema'
import { getShiftTimeRange } from '@/features/shifts/utils'
import {
  type CrewKind,
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type RotatePatternEntry,
} from './data/schema'
import {
  type CoverageCrew,
  type CrewPlacement,
  type ShiftHours,
  type SuggestionSlot,
  placementShifts,
} from './rotation-suggestion'

// Only the fields the reconstruction needs, so this doesn't drag the whole
// team schema across feature lines.
export type RotationCrewTeam = {
  id: string
  name: string
  employee_ids: string[]
}

export function patternToSlots(
  pattern: RotatePatternEntry[]
): SuggestionSlot[] {
  return pattern.map((entry, index) => ({
    index,
    shiftId: entry.is_off ? undefined : entry.shift_id,
    isOff: entry.is_off || !entry.shift_id,
  }))
}

// A shift with no enabled day sorts last rather than first, so an
// unconfigured shift does not silently become the head of the rotation.
function shiftStartMinutes(shift: Shift): number {
  const starts = shift.days
    .filter((day) => day.enabled)
    .flatMap((day) => day.times.map((time) => toMinutes(time.from_time)))
  return starts.length ? Math.min(...starts) : Number.POSITIVE_INFINITY
}

// Clock order, earliest first, so `shiftStep` 1 means "the next shift of the
// day". Ties break on name for stability across renders/reloads. Ids with no
// matching shift are kept, at the end — dropping them would silently shrink
// the rotation.
export function orderShiftIdsByStart(
  shiftIds: string[],
  shifts: Shift[]
): string[] {
  const byId = new Map(shifts.map((shift) => [shift.id, shift]))
  return [...shiftIds].sort((a, b) => {
    const shiftA = byId.get(a)
    const shiftB = byId.get(b)
    if (!shiftA || !shiftB) return shiftA ? -1 : shiftB ? 1 : a.localeCompare(b)
    return (
      shiftStartMinutes(shiftA) - shiftStartMinutes(shiftB) ||
      shiftA.name.localeCompare(shiftB.name)
    )
  })
}

// A shift finishing at or before it starts runs past midnight, so its end is
// pushed into the next day — this is what makes night-ending-06:00 into
// morning-starting-06:00 come out as zero rest rather than a negative day.
// Shifts with no enabled day are left out rather than defaulted: inventing
// hours for one would invent a rest violation with them.
export function shiftHoursById(shifts: Shift[]): Map<string, ShiftHours> {
  const hours = new Map<string, ShiftHours>()
  shifts.forEach((shift) => {
    const range = getShiftTimeRange(shift.days)
    if (!range) return
    const startMinutes = toMinutes(range.from_time)
    const endMinutes = toMinutes(range.to_time)
    hours.set(shift.id, {
      startMinutes,
      endMinutes: endMinutes > startMinutes ? endMinutes : endMinutes + 1440,
    })
  })
  return hours
}

// A team or employee the stores no longer know about is dropped: it cannot be
// labelled or counted, and leaving it in would report phantom coverage.
export function crewsFromDayCoverage(
  cells: RotateDayCoverage[],
  teams: RotationCrewTeam[],
  employeeLabels: Map<string, string>
): CoverageCrew[] {
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const crews = new Map<string, CoverageCrew>()

  const record = (
    key: string,
    label: string,
    headcount: number,
    day: number,
    shiftId: string
  ) => {
    let crew = crews.get(key)
    if (!crew) {
      crew = { key, label, headcount, byDay: new Map() }
      crews.set(key, crew)
    }
    const worked = crew.byDay.get(day)
    if (!worked) {
      crew.byDay.set(day, [shiftId])
      return
    }
    if (!worked.includes(shiftId)) worked.push(shiftId)
  }

  cells.forEach((cell) => {
    cell.team_ids.forEach((id) => {
      const team = teamById.get(id)
      if (!team) return
      record(
        `team:${id}`,
        team.name,
        Math.max(team.employee_ids.length, 1),
        cell.day,
        cell.shift_id
      )
    })
    cell.employee_ids.forEach((id) => {
      const label = employeeLabels.get(id)
      if (!label) return
      record(`employee:${id}`, label, 1, cell.day, cell.shift_id)
    })
  })

  return [...crews.values()]
}

// Sparse — only cells somebody landed on are written, so "no cell" and "empty
// cell" stay the same thing everywhere. Takes the *stored* placement shape
// rather than the search's own because both callers hold that shape: the
// suggestion after `crewPlacementsToStored`, and the step's "starts on day N"
// editor, which has no search result behind it.
export function cellsFromCrewPlacements(
  slots: SuggestionSlot[],
  placements: RotateCrewPlacement[],
  orderedShiftIds: string[]
): RotateDayCoverage[] {
  const cells = new Map<string, RotateDayCoverage>()

  const cellFor = (day: number, shiftId: string) => {
    const key = `${day}:${shiftId}`
    let cell = cells.get(key)
    if (!cell) {
      cell = { day, shift_id: shiftId, employee_ids: [], team_ids: [] }
      cells.set(key, cell)
    }
    return cell
  }

  placements.forEach((placement) => {
    const separator = placement.crew.indexOf(':')
    if (separator < 0) return
    const kind = placement.crew.slice(0, separator)
    const id = placement.crew.slice(separator + 1)
    if (!id) return

    placementShifts(
      slots,
      { dayOffset: placement.day_offset, shiftStep: placement.shift_step },
      orderedShiftIds
    ).forEach((shiftId, day) => {
      if (!shiftId) return
      const cell = cellFor(day, shiftId)
      if (kind === 'team') cell.team_ids.push(id)
      else cell.employee_ids.push(id)
    })
  })

  return [...cells.values()].sort(
    (a, b) => a.day - b.day || a.shift_id.localeCompare(b.shift_id)
  )
}

export function cellsFromPlacements(
  slots: SuggestionSlot[],
  placements: CrewPlacement[],
  orderedShiftIds: string[]
): RotateDayCoverage[] {
  return cellsFromCrewPlacements(
    slots,
    crewPlacementsToStored(placements),
    orderedShiftIds
  )
}

// Only the crew's key survives — the label and headcount are looked up from
// the stores on the way back out, so a renamed team does not leave a stale
// name in the record.
export function crewPlacementsToStored(
  placements: CrewPlacement[]
): RotateCrewPlacement[] {
  return placements.map((placement) => ({
    crew: placement.crew.key,
    day_offset: placement.dayOffset,
    shift_step: placement.shiftStep,
  }))
}

function normalizeCells(cells: RotateDayCoverage[]): string {
  return JSON.stringify(
    cells
      .filter((cell) => cell.employee_ids.length || cell.team_ids.length)
      .map((cell) => ({
        day: cell.day,
        shift_id: cell.shift_id,
        employee_ids: [...cell.employee_ids].sort(),
        team_ids: [...cell.team_ids].sort(),
      }))
      .sort((a, b) => a.day - b.day || a.shift_id.localeCompare(b.shift_id))
  )
}

// Re-derived by regenerating and comparing, never tracked as a flag: a flag
// has to be cleared on every path that touches a cell, and the one path that
// forgets makes the record lie. False means a cell was hand-edited (or the
// pool changed under them); callers must show the matrix as-is and not
// re-apply the offsets, which would undo the edit.
export function dayCoverageMatchesPlacements(
  slots: SuggestionSlot[],
  placements: RotateCrewPlacement[],
  orderedShiftIds: string[],
  cells: RotateDayCoverage[]
): boolean {
  if (placements.length === 0) return false
  return (
    normalizeCells(
      cellsFromCrewPlacements(slots, placements, orderedShiftIds)
    ) === normalizeCells(cells)
  )
}

// The `kind:id` form the suggestion and the step's crew pool both use.
export function crewKeysFromDayCoverage(cells: RotateDayCoverage[]): string[] {
  const keys = new Set<string>()
  cells.forEach((cell) => {
    cell.team_ids.forEach((id) => keys.add(`team:${id}`))
    cell.employee_ids.forEach((id) => keys.add(`employee:${id}`))
  })
  return [...keys]
}

// Recovers the "Assign to" pick from a roster saved before the step stored
// it. Teams win when both kinds are present — the same tie-break the work
// step's own pool uses.
export function crewSelectionFromDayCoverage(cells: RotateDayCoverage[]): {
  crew_kind: CrewKind
  crew_ids: string[]
} {
  const keys = crewKeysFromDayCoverage(cells)
  const teamIds = keys
    .filter((key) => key.startsWith('team:'))
    .map((key) => key.slice('team:'.length))
  if (teamIds.length) return { crew_kind: 'team', crew_ids: teamIds }
  return {
    crew_kind: 'employee',
    crew_ids: keys
      .filter((key) => key.startsWith('employee:'))
      .map((key) => key.slice('employee:'.length)),
  }
}

// Drops everybody the "Assign to" step no longer names — the other crew kind
// entirely, and any unpicked crew of this one — so the work step never shows
// a roster built from people who are not on the schedule anymore.
export function pruneRosterToCrews(
  cells: RotateDayCoverage[],
  placements: RotateCrewPlacement[],
  kind: CrewKind,
  ids: string[]
): { day_coverage: RotateDayCoverage[]; crew_placements: RotateCrewPlacement[] } {
  const keep = new Set(ids)
  const keepKeys = new Set(ids.map((id) => `${kind}:${id}`))
  return {
    day_coverage: cells
      .map((cell) => ({
        ...cell,
        team_ids: kind === 'team' ? cell.team_ids.filter((id) => keep.has(id)) : [],
        employee_ids:
          kind === 'employee'
            ? cell.employee_ids.filter((id) => keep.has(id))
            : [],
      }))
      .filter((cell) => cell.team_ids.length || cell.employee_ids.length),
    crew_placements: placements.filter((placement) =>
      keepKeys.has(placement.crew)
    ),
  }
}
