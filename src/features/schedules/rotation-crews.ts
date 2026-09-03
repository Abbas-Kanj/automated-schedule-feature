// Reads a rotate schedule's stored `pattern[]` back as the slot/crew model
// `rotation-suggestion.ts` reasons in.
//
// The pattern is the only place a rotation's roster lives — a crew's starting
// offset *is* the position its `employee_ids` / `team_ids` sit on. Anything
// that wants to show or grade the rotation (the "Assign to" step's coverage
// grid, the Summary's read-back) has to reconstruct the same crews from it, so
// the reconstruction lives here rather than in either screen.
import { type RotatePatternEntry } from './data/schema'
import {
  type CrewAssignment,
  type SuggestionCrew,
  type SuggestionSlot,
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

// A crew is one team (all its members rotate together) or one individually
// picked employee.
//
// Dedupes on first appearance to match `getRotationRoster`, which gives an
// employee the first position that names them — so callers show the rotation
// the Schedule Rotation screen will actually render, double-booking included.
export function assignmentsFromPattern(
  pattern: RotatePatternEntry[],
  teams: RotationCrewTeam[],
  employeeLabels: Map<string, string>
): CrewAssignment[] {
  const seen = new Set<string>()
  const assignments: CrewAssignment[] = []

  pattern.forEach((entry, index) => {
    const push = (crew: SuggestionCrew) => {
      if (seen.has(crew.key)) return
      seen.add(crew.key)
      assignments.push({ crew, offset: index })
    }

    ;(entry.team_ids ?? []).forEach((id) => {
      const team = teams.find((t) => t.id === id)
      if (!team) return
      push({
        key: `team:${id}`,
        kind: 'team',
        label: team.name,
        employeeIds: team.employee_ids,
        fixedShiftId: entry.crew_shift_id,
      })
    })
    ;(entry.employee_ids ?? []).forEach((id) => {
      const label = employeeLabels.get(id)
      if (!label) return
      push({
        key: `employee:${id}`,
        kind: 'employee',
        label,
        employeeIds: [id],
        fixedShiftId: entry.crew_shift_id,
      })
    })
  })

  return assignments
}
