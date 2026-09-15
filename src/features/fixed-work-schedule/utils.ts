import { addDays, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import {
  type RegularSchedule,
  type Schedule,
} from '@/features/schedules/data/schema'
import {
  occurrenceKeyOn,
  occurrenceSlots,
} from '@/features/schedules/occurrence-pattern'
import {
  crewsFromDayCoverage,
  orderShiftIdsByStart,
} from '@/features/schedules/rotation-crews'
import { type Shift } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'
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

export type FixedSchedule = Extract<RegularSchedule, { type: 'fixed' }>

export function isFixedSchedule(
  schedule: Schedule
): schedule is FixedSchedule {
  return schedule.parent_type === 'regular' && schedule.type === 'fixed'
}

// A bound rather than "until found" — a rule with no working day at all
// (weekly, nothing ticked) would otherwise never stop.
const MAX_WALK_DAYS = 366 * 10

// Null when the schedule isn't running that day — before its start, past its
// end, or a day the rule has off. The end is resolved once so callers can ask
// about many days.
export function makeWorkingKeyOn(
  schedule: FixedSchedule
): (date: Date) => number | null {
  const start = parseScheduleStart(schedule.start_date)
  const { end_type, end_date, end_occurrences } = schedule.end_settings

  let last: Date | null =
    end_type === 'on_date' && end_date ? parseScheduleStart(end_date) : null

  if (end_type === 'after_occurrences' && end_occurrences) {
    // Counted in working days, not calendar days.
    let seen = 0
    for (let offset = 0; offset < MAX_WALK_DAYS; offset++) {
      const date = addDays(start, offset)
      if (occurrenceKeyOn(schedule.occurrence, start, date) === null) continue
      seen++
      if (seen === end_occurrences) {
        last = date
        break
      }
    }
  }

  return (date) => {
    const day = startOfDay(date)
    if (isBefore(day, start) || (last && isAfter(day, last))) return null
    return occurrenceKeyOn(schedule.occurrence, start, day)
  }
}

function firstWorkingDate(
  schedule: FixedSchedule,
  keyOn: (date: Date) => number | null,
  keys: Set<number>
): Date {
  const start = parseScheduleStart(schedule.start_date)
  for (let offset = 0; offset < MAX_WALK_DAYS; offset++) {
    const date = addDays(start, offset)
    const key = keyOn(date)
    if (key !== null && keys.has(key)) return date
  }
  return start
}

function shiftLegend(
  schedule: FixedSchedule,
  shifts: Shift[]
): RotationPosition[] {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const legend = orderShiftIdsByStart(schedule.shift_ids, shifts)
    .map((id, index) => {
      const shift = shiftById.get(id)
      return shift ? toPosition(index, shift) : undefined
    })
    .filter((position): position is RotationPosition => position !== undefined)
  return [...legend, toPosition(legend.length, undefined, true)]
}

// Same shape the rotating screen draws, so both render through
// `RotationTimelineGrid`. `cycleDay` holds the day's occurrence slot key, or
// -1 when the schedule is off.
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
  const keyOn = makeWorkingKeyOn(schedule)

  const days: TimelineDay[] = spanDays(viewDate, span).map((date) => ({
    date,
    cycleDay: keyOn(date) ?? -1,
    isToday: isSameDay(date, today),
  }))

  const crews = crewsFromDayCoverage(
    schedule.day_coverage,
    teams,
    employeeLabels
  ).sort((a, b) => a.label.localeCompare(b.label))

  const rows = crews.map((crew) => {
    const cells = days.map((day) => {
      // First shift wins on a hand-made double booking.
      const shiftId =
        day.cycleDay >= 0 ? crew.byDay.get(day.cycleDay)?.[0] : undefined
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
      startDate: firstWorkingDate(schedule, keyOn, new Set(crew.byDay.keys())),
      daysOn: cells.filter((cell) => !cell.isOff).length,
    }
  })

  return {
    days,
    blocks: toBlocks(days, span),
    rows,
    legend: shiftLegend(schedule, shifts),
    rangeLabel: getRangeLabel(
      days[0].date,
      days[days.length - 1].date,
      span === 'week' ? 'weekly' : 'monthly'
    ),
    span,
    cycleLength: occurrenceSlots(schedule.occurrence, undefined).slotKeys
      .length,
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
  const { slotKeys, labels } = occurrenceSlots(schedule.occurrence, undefined)
  const order = orderShiftIdsByStart(schedule.shift_ids, shifts)
  const dateKey = makeWorkingKeyOn(schedule)(date)

  return getRotationRoster(schedule, employees, teams).map(
    ({ employee, employeeId, byDay, crewLabel }) => {
      // Walked in slot order so the days read Monday first.
      const daysByShift = new Map<string, string[]>()
      slotKeys.forEach((key, index) => {
        const shiftId = byDay.get(key)
        if (!shiftId) return
        const days = daysByShift.get(shiftId) ?? []
        days.push(labels[index])
        daysByShift.set(shiftId, days)
      })

      const workedShifts = [...daysByShift.entries()]
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
        .map(([shiftId, days], index) => ({
          position: toPosition(index, shiftById.get(shiftId)),
          days,
        }))

      const shiftOnDate = dateKey === null ? undefined : byDay.get(dateKey)

      return {
        employeeId,
        employee,
        fullName: getEmployeeFullName(employee),
        crewLabel,
        shifts: workedShifts,
        onDate: toPosition(
          -1,
          shiftOnDate ? shiftById.get(shiftOnDate) : undefined
        ),
      }
    }
  )
}

// Only a monthly rule needs the month seen whole.
export function getFixedDefaultSpan(schedule: FixedSchedule): TimelineSpan {
  return schedule.occurrence.frequency === 'monthly' ? 'month' : 'week'
}
