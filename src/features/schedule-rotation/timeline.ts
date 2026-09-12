// The crew-by-day view of a rotation: one row per crew, one dot per calendar
// day, colored by the shift that crew works that day.
//
// This is a different question from the one `utils.ts`'s `buildRotation`
// answers. That one is per *employee* ("what is Amir on this week, and what
// does his cycle look like from here"). This one is per *crew* across a run of
// consecutive days — the shape a rotation is actually designed in and reviewed
// as, where the interesting property is how the colored bands step sideways
// row over row.
//
// It reads `day_coverage` through `crewsFromDayCoverage`, the same
// reconstruction the suggestion scorer uses, so the picture on screen and the
// grade the form gives are built from one source.
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isBefore,
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

// How much calendar the grid covers at once. A week is the readable unit for
// "who is on right now"; a month is the unit a rotation is *designed* in —
// long enough for a 28-day cycle to close, which is where the stepping bands
// become visible.
export type TimelineSpan = 'week' | 'month'

// Days are grouped in sevens so a row reads as weeks, matching how rosters are
// written down ("days 1-7, days 8-14, ..."). A cycle whose length isn't a
// multiple of seven just gets a short final block.
const DAYS_PER_BLOCK = 7

export type TimelineDay = {
  date: Date
  // Which day of the schedule's own cycle this calendar day lands on. Same for
  // every crew — crews differ by what the matrix gives each of them on it.
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
  // One entry per day in `days`, index-aligned — so a row renders by walking
  // the blocks and indexing into this. `undefined` means the day is before
  // this crew joined the rotation: nothing happened, which is a different
  // statement from an off day, where the crew exists and is resting.
  cells: (RotationPosition | undefined)[]
  // The first calendar day this crew actually works. Derived from the
  // schedule's own start rather than from the visible range, so navigating
  // months never changes what it says.
  startDate: Date
  // Working days in the visible range. Shown because equity across crews is
  // the first thing anybody checks on a grid like this, and counting dots by
  // eye across 31 columns is exactly what a computer should be doing.
  daysOn: number
}

export type RotationTimeline = {
  days: TimelineDay[]
  blocks: TimelineBlock[]
  rows: TimelineCrewRow[]
  // The schedule's selected shifts in clock order, plus a trailing "off"
  // entry — the key that decodes the dots.
  legend: RotationPosition[]
  rangeLabel: string
  span: TimelineSpan
  cycleLength: number
}

// How many calendar days one cycle position covers, which is what turns a
// crew's cycle-day offset into a real date.
const DAYS_PER_ADVANCE: Record<RotationPeriodType, number> = {
  daily: 1,
  weekly: 7,
  monthly: 31,
}

// The first calendar day on or after the schedule's start that this crew is
// rostered on. Walked rather than computed, because `getPeriodIndex` is the
// one place that knows how a date maps onto a cycle day and duplicating that
// arithmetic here is how the two would drift apart.
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

function spanDays(viewDate: Date, span: TimelineSpan): Date[] {
  if (span === 'week') {
    const start = startOfWeek(viewDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }
  const start = startOfMonth(viewDate)
  const length = differenceInCalendarDays(endOfMonth(viewDate), start) + 1
  return Array.from({ length }, (_, i) => addDays(start, i))
}

function toBlocks(days: TimelineDay[], span: TimelineSpan): TimelineBlock[] {
  const blocks: TimelineBlock[] = []
  for (let i = 0; i < days.length; i += DAYS_PER_BLOCK) {
    const slice = days.slice(i, i + DAYS_PER_BLOCK)
    const first = slice[0].date
    const last = slice[slice.length - 1].date
    const sameMonth = first.getMonth() === last.getMonth()
    blocks.push({
      key: format(first, 'yyyy-MM-dd'),
      // Within a month the "days N-M" phrasing is the one rosters are written
      // in; a lone week is better named by its dates, which are already the
      // column headers' context.
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
  // How fast the cycle advances — the screen's Daily/Weekly/Monthly choice.
  // The grid always draws calendar *days*; this only decides how many of them
  // share a cycle position, so a weekly rotation renders as seven identical
  // dots in a row rather than as seven different ones.
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

  const scheduleStart = parseScheduleStart(schedule.start_date)
  const spanned = spanDays(viewDate, span)
  // A rotation does not exist before its start date, so the grid does not
  // draw those columns at all rather than drawing empty ones nobody can act
  // on.
  const days: TimelineDay[] = spanned
    .filter((date) => !isBefore(date, scheduleStart))
    .map((date) => ({
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
      // Before this crew's own first working day there is nothing to say —
      // not "off", which would claim they were rostered and resting.
      if (isBefore(day.date, startDate)) return undefined
      // A hand-made double booking lands two shifts on one day; the first is
      // drawn, the same way the employee table resolves it, so the two screens
      // never disagree about what a cell shows. The form warns about it in
      // place rather than either screen inventing a way to draw both.
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
      daysOn: cells.filter((cell) => cell && !cell.isOff).length,
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
    // Labelled by what is drawn, falling back to the raw span when the
    // clamp above left nothing — the navigator still needs a caption.
    rangeLabel: getRangeLabel(
      days[0]?.date ?? spanned[0],
      days[days.length - 1]?.date ?? spanned[spanned.length - 1],
      span === 'week' ? 'weekly' : 'monthly'
    ),
    span,
    cycleLength,
  }
}

// The schedule's start, as a date. Kept here so the screen and the builder
// parse it the same way.
export function parseScheduleStart(startDate: string): Date {
  return startOfDay(parse(startDate, 'yyyy-MM-dd', new Date()))
}
