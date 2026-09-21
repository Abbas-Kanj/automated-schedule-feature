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
import { getScheduleCycleLength } from '@/features/schedules/utils'
import { type Shift, type ShiftBadgeColor } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'

// Only `rotate` schedules carry a shift pattern to rotate people through.
export type RotateSchedule = Extract<RegularSchedule, { type: 'rotate' }>

export function isRotateSchedule(
  schedule: Schedule
): schedule is RotateSchedule {
  return schedule.parent_type === 'regular' && schedule.type === 'rotate'
}

// Each advances the rotation by exactly one pattern position. `daily` makes a
// day-based pattern mean what it says — a 2-2-3 roster is fourteen *days*, so
// cards advance one per day; read weekly, the same cards would be a
// fourteen-*week* cycle. `weekly` (Monday-first) and `monthly` treat a card as
// a whole week or month on one shift.
export type RotationPeriodType = 'daily' | 'weekly' | 'monthly'

// One resolved day of the cycle — a pattern card (template) or an employee's
// actual cell. `isOff` is re-derived rather than trusted, so a day pointing at
// a since-deleted shift still reads as off.
export type RotationPosition = {
  index: number
  shift?: Shift
  isOff: boolean
  // Single-letter chip for the sequence column: Morning -> "M", off -> "O".
  letter: string
  label: string
  badgeColor?: ShiftBadgeColor
}

export type RotationRow = {
  employee: Employee
  employeeId: string
  fullName: string
  // First cycle day this employee works — a sort key, not a stagger (the
  // roster is stored per (day, shift), not as an offset).
  offset: number
  // The crew this employee rotates with, and the cycle day it starts on — the
  // "Team B starts on week 2" half. `startDay` is only set while the stored
  // start days still describe the stored matrix.
  crewKey?: string
  crewLabel?: string
  startDay?: number
  // The first real date this crew is on duty.
  startDate?: Date
  assignedIndex: number
  assigned: RotationPosition
  // Rotated so the day they're on now comes first (Alice "M A N O", Bob
  // "A N O M").
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

export function toPosition(
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

// The *template* — one crew's journey through the cycle, not who actually
// works it (see `getRotationRoster`).
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

// Reads only the schedule's own `day_coverage` matrix — a shift's own "Assign
// to" picks say who may work it in general, not who covers this rotation.
// Fixed schedules store the same shape under occurrence slot keys, so they go
// through here too.
export function getRotationRoster<
  S extends Pick<RotateSchedule, 'day_coverage'>,
>(
  schedule: S,
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
  // A team is worth naming; an individually picked employee is their own
  // crew, so no label is repeated under their own name.
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
    // First one wins on a hand-made double booking.
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

// A fact about the schedule, not something to ask the user: a `pattern` card
// is normally one day, so the cycle steps daily. The exception is a
// `custom_shifts` card whose shift repeats weekly (see
// `expandRotatePatternDays` in `schedules/utils.ts`) — then a card spans a
// real week, detected by the cycle being longer in days than it has cards.
export function getAdvanceType(schedule: RotateSchedule): RotationPeriodType {
  const cycleDays = getScheduleCycleLength({
    type: schedule.type,
    start_date: schedule.start_date,
    pattern: schedule.pattern,
    shift_repeat: schedule.shift_repeat,
  })
  return cycleDays === schedule.pattern.length ? 'daily' : 'weekly'
}

// The span a schedule's own cycle is written in: a monthly cycle read weekly
// never closes on screen, a weekly one read monthly buries the stepping
// bands. Custom-day cycles go by length. A starting point only — tabs stay
// clickable after.
export function getDefaultSpan(schedule: RotateSchedule): 'week' | 'month' {
  if (schedule.cycle_length.unit === 'monthly') return 'month'
  if (schedule.cycle_length.unit === 'weekly') return 'week'
  return schedule.pattern.length > 7 ? 'month' : 'week'
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

// Period 0 contains `start_date`; negative before it — the rotation math
// wraps either way.
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

// How many calendar days one cycle position covers, at most.
const DAYS_PER_ADVANCE: Record<RotationPeriodType, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
}

// The first real date on or after `start_date` that each cycle day falls on,
// index-aligned with the cycle. Walked through `getPeriodIndex` rather than
// computed, so it can never disagree with how the screens map dates to days.
// A slot stays undefined only if the start date is unusable.
// `cycleDayDates` gives the first calendar date each cycle *day* falls on, so
// the earliest of the days a crew actually works is the date it first comes on
// duty. Mirrors the timeline's own forward walk without duplicating the date
// arithmetic a second time.
function firstWorkedDate(
  byDay: Map<number, string>,
  cycleDates: (Date | undefined)[]
): Date | undefined {
  let earliest: Date | undefined
  byDay.forEach((_shiftId, day) => {
    const date = cycleDates[day]
    if (date && (!earliest || date < earliest)) earliest = date
  })
  return earliest
}

export function cycleDayDates(
  schedule: RotateSchedule,
  periodType: RotationPeriodType,
  cycleLength: number = schedule.pattern.length
): (Date | undefined)[] {
  const dates: (Date | undefined)[] = Array.from({ length: cycleLength })
  const start = parse(schedule.start_date, 'yyyy-MM-dd', new Date())
  if (!cycleLength || Number.isNaN(start.getTime())) return dates

  let found = 0
  // One extra period, since the start can sit part-way through its first.
  const limit = (cycleLength + 1) * DAYS_PER_ADVANCE[periodType]
  for (let offset = 0; offset < limit && found < cycleLength; offset++) {
    const date = addDays(start, offset)
    const day = getAssignedIndex(
      0,
      getPeriodIndex(schedule, date, periodType),
      cycleLength
    )
    if (dates[day]) continue
    dates[day] = date
    found++
  }
  return dates
}

// Wrapped into [0, cycleLength). `offset` stays a parameter because the
// pattern preview walks the cards from an arbitrary starting card.
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

  // Same cycle day for everyone — people differ by what the matrix gives
  // them, not by an offset into a shared pattern.
  const assignedIndex = cycleLength
    ? getAssignedIndex(0, periodIndex, cycleLength)
    : 0

  // Start days are only shown when they still truly describe the matrix — a
  // roster finished by hand is no longer "each crew a week apart".
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
  const startDates = placementsDescribeCoverage
    ? cycleDayDates(schedule, periodType, cycleLength)
    : []

  const rows: RotationRow[] = roster.map(
    ({ employee, employeeId, byDay, offset, crewKey, crewLabel }) => {
      const dayFor = (day: number) => {
        const shiftId = byDay.get(day)
        return toPosition(day, shiftId ? shiftById.get(shiftId) : undefined)
      }
      // Rotated so the day they're on right now reads first.
      const sequence = positions.map((_, i) =>
        dayFor((assignedIndex + i) % cycleLength)
      )

      const startDay =
        placementsDescribeCoverage && crewKey
          ? placementByCrew.get(crewKey)?.day_offset
          : undefined

      return {
        employee,
        employeeId,
        fullName: getEmployeeFullName(employee),
        offset,
        crewKey,
        crewLabel,
        startDay,
        // The crew's first day *on duty*, not the date its cycle position
        // falls on. `day_offset` says which card the crew stands on at day 0,
        // so `startDates[day_offset]` answers a different question entirely —
        // it read "starts Sep 7" for a crew already working on Aug 31, and
        // disagreed with the timeline's own label on the same screen.
        startDate:
          startDay === undefined
            ? undefined
            : firstWorkedDate(byDay, startDates),
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
