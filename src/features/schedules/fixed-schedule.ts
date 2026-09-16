// Fixed schedules store who works each shift (`shift_assignments`) and on
// which days each shift runs (`shift_occurrences`). Pure helpers over that
// shape, shared by the wizard, its summary and the fixed Work schedule screen.
import {
  type CrewKind,
  type ShiftAssignment,
  DEFAULT_OCCURRENCE_EXCEPTIONS,
} from './data/schema'

// The ids of `kind` on one shift.
export function shiftCrewIds(
  assignments: ShiftAssignment[] | undefined,
  shiftId: string,
  kind: CrewKind
): string[] {
  const row = (assignments ?? []).find((a) => a.shift_id === shiftId)
  return (kind === 'team' ? row?.team_ids : row?.employee_ids) ?? []
}

// Replaces one shift's crews of `kind`, dropping rows nobody is on so "no
// row" and "empty row" keep meaning the same thing.
export function withShiftCrewIds(
  assignments: ShiftAssignment[] | undefined,
  shiftId: string,
  kind: CrewKind,
  ids: string[]
): ShiftAssignment[] {
  const key = kind === 'team' ? 'team_ids' : 'employee_ids'
  const current = assignments ?? []
  const existing = current.find((a) => a.shift_id === shiftId)
  const next = existing
    ? current.map((a) => (a === existing ? { ...a, [key]: ids } : a))
    : [
        ...current,
        { shift_id: shiftId, employee_ids: [], team_ids: [], [key]: ids },
      ]
  return next.filter((a) => a.employee_ids.length || a.team_ids.length)
}

// Crews of `kind` picked on more than one shift, with the shifts they're on.
// Allowed — the step only warns.
export function crewsOnMultipleShifts(
  assignments: ShiftAssignment[] | undefined,
  kind: CrewKind
): Map<string, string[]> {
  const shiftsByCrew = new Map<string, string[]>()
  ;(assignments ?? []).forEach((assignment) => {
    const ids = kind === 'team' ? assignment.team_ids : assignment.employee_ids
    new Set(ids).forEach((id) => {
      const shifts = shiftsByCrew.get(id) ?? []
      if (!shifts.includes(assignment.shift_id))
        shifts.push(assignment.shift_id)
      shiftsByCrew.set(id, shifts)
    })
  })
  return new Map([...shiftsByCrew].filter(([, shifts]) => shifts.length > 1))
}

// Distinct crews of `kind` across every shift.
export function assignedCrewIds(
  assignments: ShiftAssignment[] | undefined,
  kind: CrewKind
): string[] {
  return [
    ...new Set(
      (assignments ?? []).flatMap((a) =>
        kind === 'team' ? a.team_ids : a.employee_ids
      )
    ),
  ]
}

type LegacyCell = {
  day?: unknown
  shift_id?: unknown
  employee_ids?: unknown
  team_ids?: unknown
}

const asIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []

// Fixed schedules saved before occurrence went per shift carried one
// `occurrence` for all shifts and a slot-keyed `day_coverage`. Rewrites that
// into the current shape; anything else passes through untouched.
export function migrateLegacyFixedSchedule(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const record = raw as Record<string, unknown>
  if (record.type !== 'fixed' || !('occurrence' in record)) return raw

  const { occurrence, day_coverage: dayCoverage } = record
  const rest = { ...record }
  delete rest.occurrence
  delete rest.day_coverage
  delete rest.crew_placements
  delete rest.crew_ids
  const { exceptions, ...rule } = (occurrence ?? {}) as Record<string, unknown>
  const shiftIds = asIds(record.shift_ids)

  const byShift = new Map<string, ShiftAssignment>()
  ;(Array.isArray(dayCoverage) ? (dayCoverage as LegacyCell[]) : []).forEach(
    (cell) => {
      if (typeof cell.shift_id !== 'string') return
      const row = byShift.get(cell.shift_id) ?? {
        shift_id: cell.shift_id,
        employee_ids: [],
        team_ids: [],
      }
      row.employee_ids = [
        ...new Set([...row.employee_ids, ...asIds(cell.employee_ids)]),
      ]
      row.team_ids = [...new Set([...row.team_ids, ...asIds(cell.team_ids)])]
      byShift.set(cell.shift_id, row)
    }
  )

  return {
    ...rest,
    shift_occurrences:
      record.shift_occurrences ??
      (occurrence ? shiftIds.map((id) => ({ ...rule, shift_id: id })) : []),
    occurrence_exceptions:
      record.occurrence_exceptions ??
      exceptions ??
      DEFAULT_OCCURRENCE_EXCEPTIONS,
    shift_assignments: record.shift_assignments ?? [...byShift.values()],
  }
}
