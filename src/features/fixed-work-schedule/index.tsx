import { useMemo, useState } from 'react'
import { format, isBefore, isWithinInterval } from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { EmptyState } from '@/features/schedule-rotation/components/empty-state'
import { RotationTimelineGrid } from '@/features/schedule-rotation/components/rotation-timeline'
import { SpanTabs } from '@/features/schedule-rotation/components/span-tabs'
import {
  type TimelineSpan,
  parseScheduleStart,
} from '@/features/schedule-rotation/timeline'
import {
  getPeriodEnd,
  getPeriodStart,
  shiftPeriod,
} from '@/features/schedule-rotation/utils'
import { useSchedulesStore } from '@/features/schedules/stores/schedules-store'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { FixedScheduleTable } from './components/fixed-schedule-table'
import {
  type FixedSchedule,
  buildFixedRoster,
  buildFixedTimeline,
  getFixedDefaultSpan,
  isFixedSchedule,
} from './utils'

// Unlike a rotation there's no cycle to see from the start, so open on today
// unless the schedule hasn't started yet.
function initialViewDate(schedule: FixedSchedule | undefined): Date {
  const today = new Date()
  if (!schedule) return today
  const start = parseScheduleStart(schedule.start_date)
  return isBefore(today, start) ? start : today
}

export function FixedWorkSchedule() {
  const schedules = useSchedulesStore((s) => s.schedules)
  const shifts = useShiftsStore((s) => s.shifts)
  const employees = useEmployeesStore((s) => s.employees)
  const teams = useTeamsStore((s) => s.teams)

  const fixedSchedules = useMemo(
    () => schedules.filter(isFixedSchedule),
    [schedules]
  )

  const [scheduleId, setScheduleId] = useState<string>(
    () => fixedSchedules[0]?.id ?? ''
  )
  const schedule =
    fixedSchedules.find((s) => s.id === scheduleId) ?? fixedSchedules[0]

  const [span, setSpan] = useState<TimelineSpan>(() =>
    fixedSchedules[0] ? getFixedDefaultSpan(fixedSchedules[0]) : 'week'
  )
  const [viewDate, setViewDate] = useState<Date>(() =>
    initialViewDate(fixedSchedules[0])
  )

  const stepType = span === 'week' ? 'weekly' : 'monthly'
  const rangeStart = getPeriodStart(viewDate, stepType)
  const rangeEnd = getPeriodEnd(viewDate, stepType)

  // Today when it is on screen, otherwise the first day shown.
  const tableDate = isWithinInterval(new Date(), {
    start: rangeStart,
    end: rangeEnd,
  })
    ? new Date()
    : rangeStart

  const timeline = schedule
    ? buildFixedTimeline(schedule, shifts, employees, teams, viewDate, span)
    : null
  const roster = schedule
    ? buildFixedRoster(schedule, shifts, employees, teams, tableDate)
    : []

  function selectSchedule(id: string) {
    setScheduleId(id)
    const next = fixedSchedules.find((s) => s.id === id)
    if (next) {
      setViewDate(initialViewDate(next))
      setSpan(getFixedDefaultSpan(next))
    }
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Fixed Work Schedule
          </h2>

          <div className='flex flex-wrap items-center gap-2'>
            <Select value={schedule?.id ?? ''} onValueChange={selectSchedule}>
              <SelectTrigger className='w-56'>
                <SelectValue placeholder='Select a schedule' />
              </SelectTrigger>
              <SelectContent>
                {fixedSchedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {schedule && (
              <Button variant='outline' size='sm' asChild>
                <Link
                  to='/schedules/$scheduleId/edit'
                  params={{ scheduleId: schedule.id }}
                >
                  <Pencil className='me-1 size-4' />
                  Edit schedule
                </Link>
              </Button>
            )}
          </div>
        </div>

        {!schedule || !timeline ? (
          <EmptyState
            icon={<CalendarDays className='size-8' />}
            title='No fixed schedules yet'
            description='Create a schedule of type “Fixed” to see who works it here.'
          />
        ) : (
          <div className='flex flex-1 flex-col gap-6'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                onClick={() => setViewDate((d) => shiftPeriod(d, stepType, -1))}
                aria-label='Previous period'
              >
                <ChevronLeft className='size-4' />
              </Button>
              <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                <CalendarDays className='size-4' />
                {timeline.rangeLabel}
              </div>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                onClick={() => setViewDate((d) => shiftPeriod(d, stepType, 1))}
                aria-label='Next period'
              >
                <ChevronRight className='size-4' />
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setViewDate(initialViewDate(schedule))}
              >
                <RotateCcw className='me-1 size-3.5' />
                Today
              </Button>
            </div>

            {timeline.rows.length === 0 ? (
              <EmptyState
                icon={<Users className='size-8' />}
                title='Nobody is assigned to this schedule'
                description='Edit the schedule and pick teams or employees for each shift on its “Assign to” step.'
              />
            ) : (
              <>
                <section className='flex flex-col gap-3'>
                  <div className='flex flex-wrap items-baseline justify-between gap-2'>
                    <h3 className='text-lg font-semibold tracking-tight'>
                      Timeline
                    </h3>
                    <SpanTabs value={span} onChange={setSpan} />
                  </div>
                  <RotationTimelineGrid timeline={timeline} />
                </section>

                <section className='flex flex-col gap-3'>
                  <h3 className='text-lg font-semibold tracking-tight'>
                    Employees
                  </h3>
                  <FixedScheduleTable
                    rows={roster}
                    dateHeading={`Shift · ${format(tableDate, 'EEE, MMM d')}`}
                  />
                </section>
              </>
            )}
          </div>
        )}
      </Main>
    </>
  )
}
