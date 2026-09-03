import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import {
  type RegularSchedule,
  type Schedule,
} from '@/features/schedules/data/schema'
import { type Shift, type ShiftBadgeColor } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'

// Only `rotate` schedules carry a shift pattern to rotate people through, so
// they're the only kind this screen operates on (see the schedule dropdown).
export type RotateSchedule = Extract<RegularSchedule, { type: 'rotate' }>

export function isRotateSchedule(
  schedule: Schedule
): schedule is RotateSchedule {
  return schedule.parent_type === 'regular' && schedule.type === 'rotate'
}

// The display granularities the screen offers — each advances the rotation by
// exactly one pattern position.
//
// `daily` is what makes a day-based pattern mean what it says: a 2-2-3 roster
// is fourteen *days*, so its fourteen cards have to advance one per day. Read
// through the weekly step the same cards would describe a fourteen-*week*
// cycle instead — the same numbers, off by a factor of seven.
//
// `weekly` (Monday-first) and `monthly` keep the older reading, where a card
// is a whole week or month on one shift — the "Amir works mornings this week,
// afternoons next week" rotation the seeded schedules describe.
export type RotationPeriodType = 'daily' | 'weekly' | 'monthly'

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
  // The crew working this position, from the schedule's own "Assign to" step
  // (see `rotatePatternEntrySchema` and
  // `schedule-form/schedule-assign-to-fields.tsx`). This is the whole roster
  // — the position's shift is only read for its name, letter and colour.
  employeeIds: string[]
  teamIds: string[]
  // Set when the crew starting here is pinned to one shift for the whole
  // rotation rather than taking each card's own shift (see
  // `crew_shift_id` in `schedules/data/schema.ts`).
  crewShiftId?: string
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
        employeeIds: entry.employee_ids ?? [],
        teamIds: entry.team_ids ?? [],
        crewShiftId: entry.crew_shift_id,
      }
    })
}

// Re-reads a cycle position through the eyes of a crew pinned to one shift:
// the card still decides whether the crew is working, its own shift decides
// what it works. An off card stays off — being pinned to days does not mean
// working through the rest cards.
export function applyCrewShift(
  position: RotationPosition,
  crewShiftId: string | undefined,
  shifts: Shift[]
): RotationPosition {
  if (!crewShiftId || position.isOff) return position
  const shift = shifts.find((s) => s.id === crewShiftId)
  if (!shift) return position

  return {
    ...position,
    shift,
    letter: (shift.name.trim().charAt(0) || '?').toUpperCase(),
    label: shift.name,
    badgeColor: shift.badge_color,
  }
}

// The roster is the schedule's own crew: every employee a cycle position is
// assigned (directly, or through a team), deduped. An employee's offset is
// the first cycle position they appear on — their stagger into the cycle.
//
// This reads the pattern and nothing else. A position's shift still carries
// its own "Assign to" picks (see `features/shifts`), but those say who may
// work that shift in general, not who holds which slot of this rotation.
// Inferring the cycle from them broke down as soon as a shift named a whole
// team — every member landed on the same position — and an off position has
// no shift to name anyone at all. A rotation's crew is set on the schedule
// now, in the form's own "Assign to" step.
export function getRotationRoster(
  positions: RotationPosition[],
  employees: Employee[],
  teams: Team[]
): {
  employee: Employee
  employeeId: string
  offset: number
  crewShiftId?: string
}[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const employeeById = new Map(
    employees.filter((e) => e.id).map((e) => [e.id as string, e])
  )
  const offsetByEmployee = new Map<string, number>()
  const crewShiftByEmployee = new Map<string, string | undefined>()

  const resolveTeams = (teamIds: string[]) =>
    teamIds.flatMap((id) => teamById.get(id)?.employee_ids ?? [])

  positions.forEach((pos) => {
    const memberIds = [...pos.employeeIds, ...resolveTeams(pos.teamIds)]
    memberIds.forEach((employeeId) => {
      if (!offsetByEmployee.has(employeeId) && employeeById.has(employeeId)) {
        offsetByEmployee.set(employeeId, pos.index)
        crewShiftByEmployee.set(employeeId, pos.crewShiftId)
      }
    })
  })

  return [...offsetByEmployee.entries()]
    .map(([employeeId, offset]) => ({
      employeeId,
      offset,
      crewShiftId: crewShiftByEmployee.get(employeeId),
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
  if (periodType === 'daily') return startOfDay(date)
  return periodType === 'weekly'
    ? startOfWeek(date, { weekStartsOn: 1 })
    : startOfMonth(date)
}

export function getPeriodEnd(date: Date, periodType: RotationPeriodType): Date {
  if (periodType === 'daily') return endOfDay(date)
  return periodType === 'weekly'
    ? endOfWeek(date, { weekStartsOn: 1 })
    : endOfMonth(date)
}

export function shiftPeriod(
  date: Date,
  periodType: RotationPeriodType,
  delta: number
): Date {
  if (periodType === 'daily') return addDays(date, delta)
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
  if (periodType === 'daily') return differenceInCalendarDays(current, anchor)
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
  if (periodType === 'daily') return format(start, 'EEE, MMM d, yyyy')
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

  const rows: RotationRow[] = roster.map(
    ({ employee, employeeId, offset, crewShiftId }) => {
      const assignedIndex = cycleLength
        ? getAssignedIndex(offset, periodIndex, cycleLength)
        : 0
      // A pinned crew reads its own shift off every working card, so the whole
      // sequence is re-resolved rather than just the current position.
      const sequence = positions.map((_, i) =>
        applyCrewShift(
          positions[(assignedIndex + i) % cycleLength],
          crewShiftId,
          shifts
        )
      )
      return {
        employee,
        employeeId,
        fullName: getEmployeeFullName(employee),
        offset,
        assignedIndex,
        assigned: applyCrewShift(positions[assignedIndex], crewShiftId, shifts),
        sequence,
      }
    }
  )

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
