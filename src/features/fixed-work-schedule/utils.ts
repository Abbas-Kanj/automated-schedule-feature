import { addDays, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import {
  type RotationTimeline,
  type TimelineDay,
  type TimelineSpan,
  parseScheduleStart,
  spanDays,
  toBlocks,
} from '@/features/schedule-rotation/timeline'
import {
  type RotationPosition,
  getRangeLabel,
  getRotationRoster,
  toPosition,
} from '@/features/schedule-rotation/utils'
import {
  type RegularSchedule,
  type RotateDayCoverage,
  type Schedule,
} from '@/features/schedules/data/schema'
import {
  occurrenceLabels,
  occursOn,
} from '@/features/schedules/occurrence-pattern'
import {
  crewsFromDayCoverage,
  orderShiftIdsByStart,
} from '@/features/schedules/rotation-crews'
import { type Shift } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'

export type FixedSchedule = Extract<RegularSchedule, { type: 'fixed' }>

export function isFixedSchedule(schedule: Schedule): schedule is FixedSchedule {
  return schedule.parent_type === 'regular' && schedule.type === 'fixed'
}

// A bound rather than "until found" — a rule with no working day at all
// (weekly, nothing ticked) would otherwise never stop.
const MAX_WALK_DAYS = 366 * 10

// The shifts running on a date, in clock order: each by its own occurrence
// rule, and none before the start or past the end. The end is resolved once
// so callers can ask about many days.
export function makeWorkingShiftsOn(
  schedule: FixedSchedule,
  shifts: Shift[]
): (date: Date) => string[] {
  const start = parseScheduleStart(schedule.start_date)
  const rules = orderShiftIdsByStart(schedule.shift_ids, shifts).flatMap(
    (shiftId) => {
      const rule = schedule.shift_occurrences.find(
        (r) => r.shift_id === shiftId
      )
      return rule ? [rule] : []
    }
  )
  const runningOn = (date: Date) =>
    rules.filter((rule) => occursOn(rule, start, date)).map((r) => r.shift_id)

  const { end_type, end_date, end_occurrences } = schedule.end_settings
  let last: Date | null =
    end_type === 'on_date' && end_date ? parseScheduleStart(end_date) : null

  if (end_type === 'after_occurrences' && end_occurrences) {
    // Counted in days any shift works, not calendar days.
    let seen = 0
    for (let offset = 0; offset < MAX_WALK_DAYS; offset++) {
      const date = addDays(start, offset)
      if (runningOn(date).length === 0) continue
      seen++
      if (seen === end_occurrences) {
        last = date
        break
      }
    }
  }

  return (date) => {
    const day = startOfDay(date)
    if (isBefore(day, start) || (last && isAfter(day, last))) return []
    return runningOn(day)
  }
}

// `shift_assignments` read as the matrix shape the rotation helpers take, one
// "day" per shift (its clock-order index), so crews and people resolve through
// the same code the rotating screen uses.
function assignmentCells(
  schedule: FixedSchedule,
  order: string[]
): RotateDayCoverage[] {
  return schedule.shift_assignments.flatMap((assignment) => {
    const day = order.indexOf(assignment.shift_id)
    return day < 0 ? [] : [{ ...assignment, day }]
  })
}

function firstWorkingDate(
  schedule: FixedSchedule,
  shiftsOn: (date: Date) => string[],
  crewShiftIds: Set<string>
): Date {
  const start = parseScheduleStart(schedule.start_date)
  for (let offset = 0; offset < MAX_WALK_DAYS; offset++) {
    const date = addDays(start, offset)
    if (shiftsOn(date).some((id) => crewShiftIds.has(id))) return date
  }
  return start
}

function shiftLegend(order: string[], shifts: Shift[]): RotationPosition[] {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const legend = order
    .map((id, index) => {
      const shift = shiftById.get(id)
      return shift ? toPosition(index, shift) : undefined
    })
    .filter((position): position is RotationPosition => position !== undefined)
  return [...legend, toPosition(legend.length, undefined, true)]
}

// Same shape the rotating screen draws, so both render through
// `RotationTimelineGrid`. `cycleDay` is 0 on a day any shift runs, -1 when the
// schedule is off.
export function buildFixedTimeline(
  schedule: FixedSchedule,
  shifts: Shift[],
  employees: Employee[],
  teams: Team[],
  viewDate: Date,
  span: TimelineSpan,
  today: Date = new Date()
): RotationTimeline {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const employeeLabels = new Map(
    employees
      .filter((e) => e.id)
      .map((e) => [e.id as string, getEmployeeFullName(e)])
  )
  const order = orderShiftIdsByStart(schedule.shift_ids, shifts)
  const shiftsOn = makeWorkingShiftsOn(schedule, shifts)

  const dates = spanDays(viewDate, span)
  const running = dates.map((date) => shiftsOn(date))
  const days: TimelineDay[] = dates.map((date, i) => ({
    date,
    cycleDay: running[i].length ? 0 : -1,
    isToday: isSameDay(date, today),
  }))

  const crews = crewsFromDayCoverage(
    assignmentCells(schedule, order),
    teams,
    employeeLabels
  ).sort((a, b) => a.label.localeCompare(b.label))

  const rows = crews.map((crew) => {
    const crewShiftIds = new Set([...crew.byDay.values()].flat())
    const cells = days.map((day, i) => {
      // Clock order, so a crew on two shifts that day shows the earlier one.
      const shiftId = running[i].find((id) => crewShiftIds.has(id))
      return toPosition(
        day.cycleDay,
        shiftId ? shiftById.get(shiftId) : undefined
      )
    })
    return {
      key: crew.key,
      label: crew.label,
      headcount: crew.headcount,
      cells,
      startDate: firstWorkingDate(schedule, shiftsOn, crewShiftIds),
      daysOn: cells.filter((cell) => !cell.isOff).length,
    }
  })

  return {
    days,
    blocks: toBlocks(days, span),
    rows,
    legend: shiftLegend(order, shifts),
    rangeLabel: getRangeLabel(
      days[0].date,
      days[days.length - 1].date,
      span === 'week' ? 'weekly' : 'monthly'
    ),
    span,
    cycleLength: order.length,
  }
}

export type FixedEmployeeRow = {
  employeeId: string
  employee: Employee
  fullName: string
  crewLabel?: string
  // Each shift this person works, in clock order, with the days it falls on
  // ("Mon", "Day 15", "2nd Mon").
  shifts: { position: RotationPosition; days: string[] }[]
  // What they work on the day the table is reading.
  onDate: RotationPosition
}

export function buildFixedRoster(
  schedule: FixedSchedule,
  shifts: Shift[],
  employees: Employee[],
  teams: Team[],
  date: Date
): FixedEmployeeRow[] {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const order = orderShiftIdsByStart(schedule.shift_ids, shifts)
  const onDate = makeWorkingShiftsOn(schedule, shifts)(date)

  return getRotationRoster(
    { day_coverage: assignmentCells(schedule, order) },
    employees,
    teams
  ).map(({ employee, employeeId, byDay, crewLabel }) => {
    const shiftIds = [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, shiftId]) => shiftId)
    const shiftOnDate = onDate.find((id) => shiftIds.includes(id))

    return {
      employeeId,
      employee,
      fullName: getEmployeeFullName(employee),
      crewLabel,
      shifts: shiftIds.map((shiftId, index) => ({
        position: toPosition(index, shiftById.get(shiftId)),
        days: occurrenceLabels(
          schedule.shift_occurrences.find((r) => r.shift_id === shiftId)
        ),
      })),
      onDate: toPosition(
        -1,
        shiftOnDate ? shiftById.get(shiftOnDate) : undefined
      ),
    }
  })
}

// Only a monthly rule needs the month seen whole.
export function getFixedDefaultSpan(schedule: FixedSchedule): TimelineSpan {
  return schedule.shift_occurrences.some((rule) => rule.frequency === 'monthly')
    ? 'month'
    : 'week'
}
