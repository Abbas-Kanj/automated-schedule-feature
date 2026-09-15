// The crew-by-day view of a rotation: one row per crew, one dot per calendar
// day. Different from `utils.ts`'s `buildRotation`, which is per *employee*;
// this is per *crew*, the shape a rotation is designed and reviewed in.
// Reads `day_coverage` via `crewsFromDayCoverage`, the same reconstruction the
// suggestion scorer uses, so the picture and the grade share one source.
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import {
  crewsFromDayCoverage,
  orderShiftIdsByStart,
} from '@/features/schedules/rotation-crews'
import { type Shift } from '@/features/shifts/data/schema'
import { type Team } from '@/features/teams/data/schema'
import {
  type RotateSchedule,
  type RotationPeriodType,
  type RotationPosition,
  getAssignedIndex,
  getPeriodIndex,
  getRangeLabel,
  toPosition,
} from './utils'

// Week is the readable "who's on now" unit; month is long enough for a
// 28-day cycle to close, where the stepping bands become visible.
export type TimelineSpan = 'week' | 'month'

// Grouped in sevens so a row reads as weeks ("days 1-7, days 8-14, ...");
// a cycle length not a multiple of seven just gets a short final block.
const DAYS_PER_BLOCK = 7

export type TimelineDay = {
  date: Date
  // Same for every crew — crews differ by what the matrix gives them on it.
  cycleDay: number
  isToday: boolean
}

export type TimelineBlock = {
  key: string
  label: string
  sublabel: string
  days: TimelineDay[]
}

export type TimelineCrewRow = {
  key: string
  label: string
  headcount: number
  // Index-aligned with `days`.
  cells: RotationPosition[]
  // Derived from the schedule's own start, not the visible range, so
  // navigating months never changes what it says.
  startDate: Date
  // Working days in the visible range, so equity across crews doesn't have to
  // be counted by eye across 31 columns.
  daysOn: number
}

export type RotationTimeline = {
  days: TimelineDay[]
  blocks: TimelineBlock[]
  rows: TimelineCrewRow[]
  // Selected shifts in clock order, plus a trailing "off" entry.
  legend: RotationPosition[]
  rangeLabel: string
  span: TimelineSpan
  cycleLength: number
}

// How many calendar days one cycle position covers.
const DAYS_PER_ADVANCE: Record<RotationPeriodType, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
}

// Walked rather than computed: `getPeriodIndex` is the one place that knows
// how a date maps onto a cycle day, so duplicating that math here would drift.
function crewStartDate(
  schedule: RotateSchedule,
  workedDays: Set<number>,
  periodType: RotationPeriodType,
  cycleLength: number
): Date {
  const start = parseScheduleStart(schedule.start_date)
  if (!cycleLength || workedDays.size === 0) return start
  const limit = cycleLength * DAYS_PER_ADVANCE[periodType] + 1
  for (let offset = 0; offset < limit; offset++) {
    const date = addDays(start, offset)
    const cycleDay = getAssignedIndex(
      0,
      getPeriodIndex(schedule, date, periodType),
      cycleLength
    )
    if (workedDays.has(cycleDay)) return date
  }
  return start
}

// Exported for the fixed-work-schedule screen, which draws the same grid.
export function spanDays(viewDate: Date, span: TimelineSpan): Date[] {
  if (span === 'week') {
    const start = startOfWeek(viewDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }
  const start = startOfMonth(viewDate)
  const length = differenceInCalendarDays(endOfMonth(viewDate), start) + 1
  return Array.from({ length }, (_, i) => addDays(start, i))
}

export function toBlocks(
  days: TimelineDay[],
  span: TimelineSpan
): TimelineBlock[] {
  const blocks: TimelineBlock[] = []
  for (let i = 0; i < days.length; i += DAYS_PER_BLOCK) {
    const slice = days.slice(i, i + DAYS_PER_BLOCK)
    const first = slice[0].date
    const last = slice[slice.length - 1].date
    const sameMonth = first.getMonth() === last.getMonth()
    blocks.push({
      key: format(first, 'yyyy-MM-dd'),
      // "Days N-M" matches how rosters are written within a month; a lone
      // week is better named by its dates.
      label:
        span === 'month'
          ? `Days ${format(first, 'd')}\u2013${format(last, 'd')}`
          : `${format(first, 'MMM d')} \u2013 ${format(last, sameMonth ? 'd' : 'MMM d')}`,
      sublabel:
        span === 'month'
          ? `${format(first, 'MMM d')} \u2013 ${format(last, sameMonth ? 'd' : 'MMM d')}`
          : format(first, 'yyyy'),
      days: slice,
    })
  }
  return blocks
}

export function buildRotationTimeline(
  schedule: RotateSchedule,
  shifts: Shift[],
  employees: Employee[],
  teams: Team[],
  viewDate: Date,
  // The grid always draws calendar days; this decides how many share a cycle
  // position (a weekly rotation renders as seven identical dots in a row).
  periodType: RotationPeriodType,
  span: TimelineSpan,
  today: Date = new Date()
): RotationTimeline {
  const cycleLength = schedule.pattern.length
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const employeeLabels = new Map(
    employees
      .filter((e) => e.id)
      .map((e) => [e.id as string, getEmployeeFullName(e)])
  )

  // Always the whole week/month, including days before the schedule's start
  // (wrapped through the cycle) — clamping those shrinks a month to one dot
  // when the schedule starts on the 31st.
  const days: TimelineDay[] = spanDays(viewDate, span).map((date) => ({
    date,
    cycleDay: cycleLength
      ? getAssignedIndex(
          0,
          getPeriodIndex(schedule, date, periodType),
          cycleLength
        )
      : 0,
    isToday: isSameDay(date, today),
  }))

  const crews = crewsFromDayCoverage(
    schedule.day_coverage,
    teams,
    employeeLabels
  ).sort(
    (a, b) =>
      Math.min(...a.byDay.keys()) - Math.min(...b.byDay.keys()) ||
      a.label.localeCompare(b.label)
  )

  const rows: TimelineCrewRow[] = crews.map((crew) => {
    const startDate = crewStartDate(
      schedule,
      new Set(crew.byDay.keys()),
      periodType,
      cycleLength
    )
    const cells = days.map((day) => {
      // First shift wins on a hand-made double booking, matching how the
      // employee table resolves it.
      const shiftId = crew.byDay.get(day.cycleDay)?.[0]
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
      startDate,
      daysOn: cells.filter((cell) => !cell.isOff).length,
    }
  })

  const legend: RotationPosition[] = orderShiftIdsByStart(
    schedule.shift_ids,
    shifts
  )
    .map((id, index) => {
      const shift = shiftById.get(id)
      return shift ? toPosition(index, shift) : undefined
    })
    .filter((position): position is RotationPosition => position !== undefined)

  return {
    days,
    blocks: toBlocks(days, span),
    rows,
    legend: [...legend, toPosition(legend.length, undefined, true)],
    rangeLabel: getRangeLabel(
      days[0].date,
      days[days.length - 1].date,
      span === 'week' ? 'weekly' : 'monthly'
    ),
    span,
    cycleLength,
  }
}

// Kept here so the screen and the builder parse the start date the same way.
export function parseScheduleStart(startDate: string): Date {
  return startOfDay(parse(startDate, 'yyyy-MM-dd', new Date()))
}
