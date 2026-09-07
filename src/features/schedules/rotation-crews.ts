// Bridges a rotate schedule's stored data and the schema-free model
// `rotation-suggestion.ts` reasons in.
//
// Two directions, both needed:
//
//   - **In:** `day_coverage` (the stored (cycle day × shift) → crews matrix)
//     becomes `CoverageCrew[]`, which is what grades the rotation. Every
//     screen that shows or scores a rotation reconstructs the same crews from
//     it, so the reconstruction lives here rather than in each screen.
//   - **Out:** the placements the search returns become `day_coverage` cells.
//
// It also owns the shift *order*, which the suggestion treats as given but
// somebody has to decide: shifts rotate in clock order, earliest start first,
// so a crew stepping one along moves forward through the day rather than
// backwards into a night.
import { toMinutes } from '@/lib/time'
import { type Shift } from '@/features/shifts/data/schema'
import { type RotateDayCoverage, type RotatePatternEntry } from './data/schema'
import {
  type CoverageCrew,
  type CrewPlacement,
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

// A shift's own start: the earliest `from_time` across the days it is enabled
// on. A shift with no enabled day sorts last rather than first, so an
// unconfigured shift does not silently become the head of the rotation.
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

// The stored matrix, read back as crews. A crew is one team (all its members
// rotate together) or one individually picked employee — the same unit the
// suggestion places, so a suggested roster round-trips through storage
// unchanged.
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
    if (worked) {
      if (!worked.includes(shiftId)) worked.push(shiftId)
      return
    }
    crew.byDay.set(day, [shiftId])
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
// only cells somebody landed on are written, so "no cell" and "empty cell"
// stay the same thing everywhere.
export function cellsFromPlacements(
  slots: SuggestionSlot[],
  placements: CrewPlacement[],
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
    const id = placement.crew.key.slice(placement.crew.key.indexOf(':') + 1)
    placementShifts(slots, placement, orderedShiftIds).forEach(
      (shiftId, day) => {
        if (!shiftId) return
        const cell = cellFor(day, shiftId)
        if (placement.crew.kind === 'team') cell.team_ids.push(id)
        else cell.employee_ids.push(id)
      }
    )
  })

  return [...cells.values()].sort(
    (a, b) => a.day - b.day || a.shift_id.localeCompare(b.shift_id)
  )
}

// The crew keys currently on a matrix, in the `kind:id` form the suggestion
// and the step's crew pool both use.
export function crewKeysFromDayCoverage(cells: RotateDayCoverage[]): string[] {
  const keys = new Set<string>()
  cells.forEach((cell) => {
    cell.team_ids.forEach((id) => keys.add(`team:${id}`))
    cell.employee_ids.forEach((id) => keys.add(`employee:${id}`))
  })
  return [...keys]
}
