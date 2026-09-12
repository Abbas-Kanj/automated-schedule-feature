// Bridges a rotate schedule's stored data and the schema-free model
// `rotation-suggestion.ts` reasons in, in both directions: `day_coverage` (the
// stored matrix) becomes `CoverageCrew[]` for grading, and the placements the
// search returns become `day_coverage` cells.
//
// It also owns the shift *order*, which the suggestion treats as given: shifts
// rotate in clock order, earliest start first, so a crew stepping one along
// moves forward through the day rather than backwards into a night.
import { toMinutes } from '@/lib/time'
import { type Shift } from '@/features/shifts/data/schema'
import { getShiftTimeRange } from '@/features/shifts/utils'
import {
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

// Only the fields the reconstruction needs, so this does not drag the whole
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

// A shift's own start: the earliest `from_time` across its enabled days. A
// shift with no enabled day sorts last rather than first, so an unconfigured
// shift does not silently become the head of the rotation.
function shiftStartMinutes(shift: Shift): number {
  const starts = shift.days
    .filter((day) => day.enabled)
    .flatMap((day) => day.times.map((time) => toMinutes(time.from_time)))
  return starts.length ? Math.min(...starts) : Number.POSITIVE_INFINITY
}

// The order a crew steps through shifts: clock order, earliest first, so
// `shiftStep` 1 means "the next shift of the day". Ties break on name so the
// order is stable across renders and reloads. Ids with no matching shift are
// kept, at the end — dropping them would silently shrink the rotation.
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

// Each shift's span in clock minutes, which is what turns "Night then Morning"
// into a number of hours off. A shift finishing at or before it starts runs
// past midnight, so its end is pushed into the next day — that is what makes a
// night ending at 06:00 into a morning starting at 06:00 come out as zero rest
// rather than a negative day.
//
// Shifts with no enabled day are left out rather than defaulted: inventing
// hours for an unconfigured shift would invent a rest violation with them.
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

// The stored matrix, read back as crews — one team (whose members rotate
// together) or one individually picked employee, the same unit the suggestion
// places, so a suggested roster round-trips through storage unchanged.
//
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

// The other direction: what the search decided, as storable cells. Sparse —
// only cells somebody landed on are written, so "no cell" and "empty cell" stay
// the same thing everywhere.
//
// Takes the *stored* placement shape rather than the search's own, because both
// callers hold that shape: the suggestion after `crewPlacementsToStored`, and
// the step's "starts on day N" editor, which has no search result behind it.
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

// The search's placements in the shape the schedule stores. Only the crew's key
// survives — the label and headcount are looked up from the stores on the way
// back out, so a renamed team does not leave a stale name in the record.
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

// Do the stored placements still describe the stored matrix?
//
// Re-derived by regenerating and comparing, never tracked as a flag: a flag has
// to be cleared on every path that touches a cell, and the one path that
// forgets makes the record lie.
//
// False means somebody hand-edited a cell (or the pool changed under them), so
// the offsets are history rather than a description. Callers show the matrix
// and say so; they must not re-apply the offsets, which would undo the edit.
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

// The crew keys currently on a matrix, in the `kind:id` form the suggestion and
// the step's crew pool both use.
export function crewKeysFromDayCoverage(cells: RotateDayCoverage[]): string[] {
  const keys = new Set<string>()
  cells.forEach((cell) => {
    cell.team_ids.forEach((id) => keys.add(`team:${id}`))
    cell.employee_ids.forEach((id) => keys.add(`employee:${id}`))
  })
  return [...keys]
}
