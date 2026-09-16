import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTimeFormat } from '@/lib/time-format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { SHIFT_ICON_COMPONENTS } from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import {
  type CalendarScheduleInput,
  type ScheduleCalendarDay,
  formatTimes,
  getScheduleCalendarCycle,
} from '../../utils'

// Monday-first, matching `getScheduleCalendarCycle`'s `weekdayIndex`.
const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type ScheduleCalendarPreviewProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: any
}

// Maps a schedule onto real calendar dates, one cycle at a time, with
// "next/previous cycle" paging instead of rendering the whole — possibly
// unbounded — schedule at once.
export function ScheduleCalendarPreview({
  values,
}: ScheduleCalendarPreviewProps) {
  const shifts = useShiftsStore((s) => s.shifts)
  const formatTime = useTimeFormat()
  const [cycleIndex, setCycleIndex] = useState(0)

  const schedule: CalendarScheduleInput = {
    type: values.type,
    start_date: values.start_date,
    shift_ids: values.shift_ids,
    pattern: values.pattern,
    shift_repeat: values.shift_repeat,
    end_settings: values.end_settings,
    shift_occurrences: values.shift_occurrences,
    shift_assignments: values.shift_assignments,
    day_coverage: values.day_coverage,
  }

  const teams = useTeamsStore((s) => s.teams)
  const employees = useEmployeesStore((s) => s.employees)
  const crewName = new Map<string, string>([
    ...teams.map((team) => [`team:${team.id}`, team.name] as const),
    ...employees
      .filter((employee) => employee.id)
      .map(
        (employee) =>
          [`employee:${employee.id}`, getEmployeeFullName(employee)] as const
      ),
  ])
  const showCrews = values.type === 'fixed' || values.type === 'rotate'

  const cycle = getScheduleCalendarCycle(schedule, shifts, cycleIndex)

  if (cycle.days.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Calendar preview will appear once shifts and dates are set.
      </p>
    )
  }

  const firstDay = cycle.days[0]
  const lastDay = cycle.days[cycle.days.length - 1]
  const rangeLabel =
    firstDay.date_str === lastDay.date_str
      ? format(firstDay.date, 'MMM d, yyyy')
      : `${format(firstDay.date, 'MMM d, yyyy')} – ${format(lastDay.date, 'MMM d, yyyy')}`

  // Pad to full weeks so every day lands under its real weekday column.
  const leadingBlanks = firstDay.weekdayIndex
  const trailingBlanks = (7 - ((leadingBlanks + cycle.days.length) % 7)) % 7

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm font-medium'>{rangeLabel}</p>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-7'
            disabled={!cycle.canGoToPreviousCycle}
            onClick={() => setCycleIndex((i) => i - 1)}
          >
            <ChevronLeftIcon className='size-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-7'
            disabled={!cycle.canGoToNextCycle}
            onClick={() => setCycleIndex((i) => i + 1)}
          >
            <ChevronRightIcon className='size-4' />
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-7 gap-1'>
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className='pb-1 text-center text-xs font-medium text-muted-foreground'
          >
            {label}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}

        {cycle.days.map((day) => (
          <CalendarDayCell
            key={day.date_str}
            day={day}
            formatTime={formatTime}
            crewName={showCrews ? crewName : undefined}
          />
        ))}

        {Array.from({ length: trailingBlanks }, (_, i) => (
          <div key={`trail-${i}`} />
        ))}
      </div>
    </div>
  )
}

function CalendarDayCell({
  day,
  formatTime,
  crewName,
}: {
  day: ScheduleCalendarDay
  formatTime: (time: string) => string
  // Set for types that carry crews; names each team/employee key.
  crewName?: Map<string, string>
}) {
  // A crew on more than one shift the same day is almost always a slip.
  const keysOf = (entry: ScheduleCalendarDay['entries'][number]) => [
    ...entry.teamIds.map((id) => `team:${id}`),
    ...entry.employeeIds.map((id) => `employee:${id}`),
  ]
  const seen = new Map<string, number>()
  day.entries.forEach((entry) =>
    keysOf(entry).forEach((key) => seen.set(key, (seen.get(key) ?? 0) + 1))
  )

  return (
    <div
      className={cn(
        'min-h-16 space-y-1 rounded-md border p-1.5',
        day.isOff && 'bg-muted/30'
      )}
    >
      <p className='text-xs text-muted-foreground'>
        {format(day.date, 'MMM d')}
      </p>
      {day.isOff ? (
        <p className='text-xs text-muted-foreground'>Off</p>
      ) : (
        <div className='space-y-1'>
          {day.entries.map((entry, i) => {
            const Icon = SHIFT_ICON_COMPONENTS[entry.shift.icon]
            return (
              <div key={`${entry.shift.id}-${i}`} className='space-y-0.5'>
                <div className='flex min-w-0 items-center gap-1'>
                  <ShiftSwatch shift={entry.shift} />
                  {Icon && (
                    <Icon className='size-3 shrink-0 text-muted-foreground' />
                  )}
                  <span className='truncate text-xs font-medium'>
                    {entry.shift.name}
                  </span>
                </div>
                <p className='truncate text-[11px] text-muted-foreground'>
                  {formatTimes(entry.times, formatTime)}
                </p>
                {crewName && (
                  <CrewLine
                    names={keysOf(entry).map((key) => crewName.get(key) ?? '?')}
                    doubleBooked={keysOf(entry).some(
                      (key) => (seen.get(key) ?? 0) > 1
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CrewLine({
  names,
  doubleBooked,
}: {
  names: string[]
  doubleBooked: boolean
}) {
  const text = names.length ? names.join(', ') : 'Unassigned'
  return (
    <p
      title={text}
      className={cn(
        'truncate text-[11px]',
        doubleBooked
          ? 'font-medium text-amber-600 dark:text-amber-400'
          : names.length
            ? 'text-foreground/80'
            : 'text-muted-foreground italic'
      )}
    >
      {text}
    </p>
  )
}
