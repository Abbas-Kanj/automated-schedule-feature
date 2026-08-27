import {
  addMonths,
  addWeeks,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import { type RegularSchedule, type Schedule } from '@/features/schedules/data/schema'
import { type Shift, type ShiftBadgeColor } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'

// Only `rotate` schedules carry a shift pattern to rotate people through, so
// they're the only kind this screen operates on (see the schedule dropdown).
export type RotateSchedule = Extract<RegularSchedule, { type: 'rotate' }>

export function isRotateSchedule(schedule: Schedule): schedule is RotateSchedule {
  return schedule.parent_type === 'regular' && schedule.type === 'rotate'
}

// Monday-first weeks / calendar months are the two display granularities the
// screen offers — each advances the rotation by one pattern position.
export type RotationPeriodType = 'weekly' | 'monthly'

// One resolved position in the rotation cycle (pattern order). `isOff` is
// re-derived rather than trusting the pattern flag alone, so a position
// pointing at a since-deleted shift still reads as off.
export type RotationPosition = {
  index: number
  shift?: Shift
  isOff: boolean
  // Single-letter chip for the "Current Schedule Sequence" column, e.g.
  // Morning -> "M", an off day -> "O".
  letter: string
  label: string
  badgeColor?: ShiftBadgeColor
}

export type RotationRow = {
  employee: Employee
  employeeId: string
  fullName: string
  // Which cycle position this employee starts at (the first pattern position
  // they're assigned to) — their stagger into the rotation.
  offset: number
  assignedIndex: number
  assigned: RotationPosition
  // The full cycle, rotated so the employee's current position comes first
  // (matches the reference UI: Alice "M A N O", Bob "A N O M").
  sequence: RotationPosition[]
}

export type Rotation = {
  positions: RotationPosition[]
  rows: RotationRow[]
  cycleLength: number
  periodIndex: number
  periodStart: Date
  periodEnd: Date
  rangeLabel: string
}

const OFF_LETTER = 'O'

// Resolves a rotate schedule's pattern (sorted by position) into display-ready
// cycle positions.
export function getRotationPositions(
  schedule: RotateSchedule,
  shifts: Shift[]
): RotationPosition[] {
  return [...schedule.pattern]
    .sort((a, b) => a.position - b.position)
    .map((entry, index) => {
      const shift = entry.is_off
        ? undefined
        : shifts.find((s) => s.id === entry.shift_id)
      const isOff = entry.is_off || !shift
      return {
        index,
        shift,
        isOff,
        letter: isOff
          ? OFF_LETTER
          : (shift!.name.trim().charAt(0) || '?').toUpperCase(),
        label: isOff ? 'Off' : shift!.name,
        badgeColor: isOff ? undefined : shift!.badge_color,
      }
    })
}

// The roster is auto-derived from the shifts in the pattern: every employee
// assigned to a pattern shift (directly, or via a team), deduped. An
// employee's offset is the first cycle position whose shift they're on — so
// people assigned to the Morning shift start the cycle on Morning, etc.
export function getRotationRoster(
  positions: RotationPosition[],
  employees: Employee[],
  teams: Team[]
): { employee: Employee; employeeId: string; offset: number }[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const employeeById = new Map(
    employees.filter((e) => e.id).map((e) => [e.id as string, e])
  )
  const offsetByEmployee = new Map<string, number>()

  positions.forEach((pos) => {
    if (pos.isOff || !pos.shift) return
    const memberIds = [
      ...pos.shift.employee_ids,
      ...pos.shift.team_ids.flatMap((id) => teamById.get(id)?.employee_ids ?? []),
    ]
    memberIds.forEach((employeeId) => {
      if (!offsetByEmployee.has(employeeId) && employeeById.has(employeeId)) {
        offsetByEmployee.set(employeeId, pos.index)
      }
    })
  })

  return [...offsetByEmployee.entries()]
    .map(([employeeId, offset]) => ({
      employeeId,
      offset,
      employee: employeeById.get(employeeId)!,
    }))
    .sort(
      (a, b) =>
        a.offset - b.offset ||
        getEmployeeFullName(a.employee).localeCompare(
          getEmployeeFullName(b.employee)
        )
    )
}

export function getPeriodStart(
  date: Date,
  periodType: RotationPeriodType
): Date {
  return periodType === 'weekly'
    ? startOfWeek(date, { weekStartsOn: 1 })
    : startOfMonth(date)
}

export function getPeriodEnd(date: Date, periodType: RotationPeriodType): Date {
  return periodType === 'weekly'
    ? endOfWeek(date, { weekStartsOn: 1 })
    : endOfMonth(date)
}

export function shiftPeriod(
  date: Date,
  periodType: RotationPeriodType,
  delta: number
): Date {
  return periodType === 'weekly'
    ? addWeeks(date, delta)
    : addMonths(date, delta)
}

// How many whole periods `viewDate` sits after the schedule's own start —
// period 0 is the period containing `start_date`. Can be negative (viewing a
// period before the schedule begins); the rotation math wraps either way.
export function getPeriodIndex(
  schedule: RotateSchedule,
  viewDate: Date,
  periodType: RotationPeriodType
): number {
  const anchor = getPeriodStart(
    parse(schedule.start_date, 'yyyy-MM-dd', new Date()),
    periodType
  )
  const current = getPeriodStart(viewDate, periodType)
  return periodType === 'weekly'
    ? differenceInCalendarWeeks(current, anchor, { weekStartsOn: 1 })
    : differenceInCalendarMonths(current, anchor)
}

// Cycle position an employee lands on for a given period — their offset
// advanced by the period index, wrapped into [0, cycleLength).
export function getAssignedIndex(
  offset: number,
  periodIndex: number,
  cycleLength: number
): number {
  return (((offset + periodIndex) % cycleLength) + cycleLength) % cycleLength
}

export function getRangeLabel(
  start: Date,
  end: Date,
  periodType: RotationPeriodType
): string {
  if (periodType === 'monthly') return format(start, 'MMMM yyyy')
  const sameMonth = start.getMonth() === end.getMonth()
  return sameMonth
    ? `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
    : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}

// Top-level builder: everything the screen needs for one schedule, one
// period type, and one view date.
export function buildRotation(
  schedule: RotateSchedule,
  shifts: Shift[],
  employees: Employee[],
  teams: Team[],
  viewDate: Date,
  periodType: RotationPeriodType
): Rotation {
  const positions = getRotationPositions(schedule, shifts)
  const cycleLength = positions.length
  const roster = getRotationRoster(positions, employees, teams)
  const periodIndex = getPeriodIndex(schedule, viewDate, periodType)
  const periodStart = getPeriodStart(viewDate, periodType)
  const periodEnd = getPeriodEnd(viewDate, periodType)

  const rows: RotationRow[] = roster.map(({ employee, employeeId, offset }) => {
    const assignedIndex = cycleLength
      ? getAssignedIndex(offset, periodIndex, cycleLength)
      : 0
    const sequence = positions.map(
      (_, i) => positions[(assignedIndex + i) % cycleLength]
    )
    return {
      employee,
      employeeId,
      fullName: getEmployeeFullName(employee),
      offset,
      assignedIndex,
      assigned: positions[assignedIndex],
      sequence,
    }
  })

  return {
    positions,
    rows,
    cycleLength,
    periodIndex,
    periodStart,
    periodEnd,
    rangeLabel: getRangeLabel(periodStart, periodEnd, periodType),
  }
}
