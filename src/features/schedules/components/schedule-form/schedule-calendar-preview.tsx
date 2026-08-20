import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimeFormat } from '@/lib/time-format'
import { Button } from '@/components/ui/button'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import {
  type CalendarScheduleInput,
  type ScheduleCalendarDay,
  formatTimes,
  getScheduleCalendarCycle,
} from '../../utils'

// Monday-first, matching the calendar grid's own weekday columns (see
// `getScheduleCalendarCycle`'s `weekdayIndex`).
const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type ScheduleCalendarPreviewProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: any
}

// Maps a fixed/flexible/rotate schedule onto real calendar dates, one
// cycle (rotate's own pattern length, or a plain week for fixed/flexible —
// see `getScheduleCycleLength`) at a time, with "next/previous cycle"
// paging instead of trying to render the whole — possibly unbounded —
// schedule at once. Sits in the Summary step in place of a flat
// position/weekday list so "what actually happens on, say, the Monday
// three weeks from now" is a straight read instead of mental math.
export function ScheduleCalendarPreview({ values }: ScheduleCalendarPreviewProps) {
  const shifts = useShiftsStore((s) => s.shifts)
  const formatTime = useTimeFormat()
  const [cycleIndex, setCycleIndex] = useState(0)

  const schedule: CalendarScheduleInput = {
    type: values.type,
    start_date: values.start_date,
    shift_ids: values.shift_ids,
    pattern: values.pattern,
    end_settings: values.end_settings,
  }

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

  // Pad the grid out to full weeks so every day lands under its real
  // weekday column, same as a real calendar month view.
  const leadingBlanks = firstDay.weekdayIndex
  const trailingBlanks =
    (7 - ((leadingBlanks + cycle.days.length) % 7)) % 7

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
}: {
  day: ScheduleCalendarDay
  formatTime: (time: string) => string
}) {
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
            const color = SHIFT_BADGE_COLOR_OPTIONS.find(
              (o) => o.value === entry.shift.badge_color
            )
            const Icon = SHIFT_ICON_COMPONENTS[entry.shift.icon]
            return (
              <div key={`${entry.shift.id}-${i}`} className='space-y-0.5'>
                <div className='flex min-w-0 items-center gap-1'>
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      color?.swatchClassName
                    )}
                  />
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
