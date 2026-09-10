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
import {
  dayCoverageMatchesPlacements,
  orderShiftIdsByStart,
  patternToSlots,
} from '@/features/schedules/rotation-crews'
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

// One resolved day of the rotation cycle. Used two ways: as a card of the
// schedule's own `pattern` (the template — see `getRotationPositions`), and as
// one cell of an employee's actual cycle (what they work that day — see
// `buildRotation`). `isOff` is re-derived rather than trusting a flag, so a
// day pointing at a since-deleted shift still reads as off.
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
  // First cycle day this employee works. Not a stagger any more — the roster
  // is stored per (day, shift) rather than as an offset into the pattern (see
  // `day_coverage` in `schedules/data/schema.ts`) — it is kept only to sort
  // the table in a stable, readable order.
  offset: number
  // The crew this employee rotates with, and the cycle day that crew starts
  // on — the "Team B starts on week 2" half of the schedule (see
  // `crew_placements` in `schedules/data/schema.ts`).
  //
  // `startDay` is only filled in when the stored start days still describe
  // the stored matrix. After a hand edit they are history, and repeating them
  // here would describe a roster this screen is not showing.
  crewKey?: string
  crewLabel?: string
  startDay?: number
  assignedIndex: number
  assigned: RotationPosition
  // The employee's own cycle, rotated so the day they are on now comes first
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

function toPosition(
  index: number,
  shift: Shift | undefined,
  forcedOff = false
): RotationPosition {
  const isOff = forcedOff || !shift
  return {
    index,
    shift: isOff ? undefined : shift,
    isOff,
    letter: isOff
      ? OFF_LETTER
      : (shift!.name.trim().charAt(0) || '?').toUpperCase(),
    label: isOff ? 'Off' : shift!.name,
    badgeColor: isOff ? undefined : shift!.badge_color,
  }
}

// Resolves a rotate schedule's pattern (sorted by position) into display-ready
// cycle days. This is the *template* — one crew's journey, the thing the
// suggestion works from (see `schedules/rotation-suggestion.ts`) — not what
// anybody in particular works. Who works what comes from `getRotationRoster`.
export function getRotationPositions(
  schedule: RotateSchedule,
  shifts: Shift[]
): RotationPosition[] {
  return [...schedule.pattern]
    .sort((a, b) => a.position - b.position)
    .map((entry, index) =>
      toPosition(
        index,
        entry.is_off ? undefined : shifts.find((s) => s.id === entry.shift_id),
        entry.is_off
      )
    )
}

// The roster is the schedule's own `day_coverage` matrix: for every employee
// it names (directly, or through a team), which shift they work on each day of
// the cycle.
//
// It used to be inferred from the pattern — a crew sat on one card and its
// offset was that card's index. That could not express what the feature now
// requires, a rotation covering *every* selected shift every day: two crews on
// the same rest rhythm working different shifts have the same offset, and one
// offset cannot name two shifts. So the resolved matrix is stored instead and
// read straight back here.
//
// A position's shift still carries its own "Assign to" picks (see
// `features/shifts`), but those say who may work that shift in general, not
// who covers which day of this rotation.
export function getRotationRoster(
  schedule: RotateSchedule,
  employees: Employee[],
  teams: Team[]
): {
  employee: Employee
  employeeId: string
  offset: number
  crewKey?: string
  crewLabel?: string
  byDay: Map<number, string>
}[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const employeeById = new Map(
    employees.filter((e) => e.id).map((e) => [e.id as string, e])
  )
  const byEmployee = new Map<string, Map<number, string>>()
  // Which crew put this employee on the rotation. A team crew is worth naming
  // — it is the unit the roster was built out of; an individually picked
  // employee is their own crew, so repeating their name under their name
  // would say nothing and is left off.
  const crewByEmployee = new Map<string, { key: string; label?: string }>()

  const record = (
    employeeId: string,
    day: number,
    shiftId: string,
    crew: { key: string; label?: string }
  ) => {
    if (!employeeById.has(employeeId)) return
    if (!crewByEmployee.has(employeeId)) crewByEmployee.set(employeeId, crew)
    let days = byEmployee.get(employeeId)
    if (!days) {
      days = new Map()
      byEmployee.set(employeeId, days)
    }
    // First one wins, so a hand-made double booking renders as one shift
    // rather than flickering between two. The form warns about it in place.
    if (!days.has(day)) days.set(day, shiftId)
  }

  schedule.day_coverage.forEach((cell) => {
    cell.employee_ids.forEach((id) =>
      record(id, cell.day, cell.shift_id, { key: `employee:${id}` })
    )
    cell.team_ids.forEach((teamId) => {
      const team = teamById.get(teamId)
      team?.employee_ids.forEach((id) =>
        record(id, cell.day, cell.shift_id, {
          key: `team:${teamId}`,
          label: team.name,
        })
      )
    })
  })

  return [...byEmployee.entries()]
    .map(([employeeId, byDay]) => ({
      employeeId,
      byDay,
      offset: Math.min(...byDay.keys()),
      crewKey: crewByEmployee.get(employeeId)?.key,
      crewLabel: crewByEmployee.get(employeeId)?.label,
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

// Cycle day a given period lands on, wrapped into [0, cycleLength). The
// `offset` is 0 for the cycle itself; it stays a parameter because the pattern
// preview elsewhere still walks the cards from an arbitrary starting card.
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
  const roster = getRotationRoster(schedule, employees, teams)
  const periodIndex = getPeriodIndex(schedule, viewDate, periodType)
  const periodStart = getPeriodStart(viewDate, periodType)
  const periodEnd = getPeriodEnd(viewDate, periodType)
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))

  // The cycle day the current period lands on. The same day for everyone now:
  // people no longer differ by an offset into a shared pattern, they differ by
  // what the matrix gives each of them on that day.
  const assignedIndex = cycleLength
    ? getAssignedIndex(0, periodIndex, cycleLength)
    : 0

  // Are the schedule's stored start days still a true description of its
  // matrix? Checked once for the whole table rather than per row, and only
  // when it holds are start days shown at all — a roster finished by hand is
  // no longer "each crew a week apart", and saying so anyway would be the
  // screen making something up.
  const orderedShiftIds = orderShiftIdsByStart(schedule.shift_ids, shifts)
  const placementsDescribeCoverage = dayCoverageMatchesPlacements(
    patternToSlots(
      [...schedule.pattern].sort((a, b) => a.position - b.position)
    ),
    schedule.crew_placements,
    orderedShiftIds,
    schedule.day_coverage
  )
  const placementByCrew = new Map(
    schedule.crew_placements.map((placement) => [placement.crew, placement])
  )

  const rows: RotationRow[] = roster.map(
    ({ employee, employeeId, byDay, crewKey, crewLabel }) => {
      const dayFor = (day: number) => {
        const shiftId = byDay.get(day)
        return toPosition(day, shiftId ? shiftById.get(shiftId) : undefined)
      }
      // Rotated so the day they are on right now reads first, matching the
      // "Current Schedule Sequence" column.
      const sequence = positions.map((_, i) =>
        dayFor((assignedIndex + i) % cycleLength)
      )

      return {
        employee,
        employeeId,
        fullName: getEmployeeFullName(employee),
        offset: Math.min(...byDay.keys()),
        crewKey,
        crewLabel,
        startDay:
          placementsDescribeCoverage && crewKey
            ? placementByCrew.get(crewKey)?.day_offset
            : undefined,
        assignedIndex,
        assigned: dayFor(assignedIndex),
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
