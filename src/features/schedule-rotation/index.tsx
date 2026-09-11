import { type ReactNode, useMemo, useState } from 'react'
import { format, isWithinInterval, parse } from 'date-fns'
import { Link } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { useSchedulesStore } from '@/features/schedules/stores/schedules-store'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { RotationTimelineGrid } from './components/rotation-timeline'
import { ScheduleRotationTable } from './components/schedule-rotation-table'
import { ShiftBadge } from './components/shift-badge'
import { SPAN_OPTIONS } from './data'
import { type TimelineSpan, buildRotationTimeline } from './timeline'
import {
  type RotationPeriodType,
  buildRotation,
  getAdvanceType,
  getPeriodEnd,
  getPeriodStart,
  isRotateSchedule,
  shiftPeriod,
} from './utils'

function scheduleStartDate(startDate: string): Date {
  return parse(startDate, 'yyyy-MM-dd', new Date())
}

export function ScheduleRotation() {
  const schedules = useSchedulesStore((s) => s.schedules)
  const shifts = useShiftsStore((s) => s.shifts)
  const employees = useEmployeesStore((s) => s.employees)
  const teams = useTeamsStore((s) => s.teams)

  const rotateSchedules = useMemo(
    () => schedules.filter(isRotateSchedule),
    [schedules]
  )

  const [scheduleId, setScheduleId] = useState<string>(
    () => rotateSchedules[0]?.id ?? ''
  )
  // The one control on this screen: how much calendar is on it. Everything
  // else it used to ask for was either a consequence of this or a property of
  // the schedule itself (see `advanceType`).
  const [span, setSpan] = useState<TimelineSpan>('month')

  const schedule =
    rotateSchedules.find((s) => s.id === scheduleId) ?? rotateSchedules[0]

  const [viewDate, setViewDate] = useState<Date>(() =>
    schedule ? scheduleStartDate(schedule.start_date) : new Date()
  )

  const advanceType: RotationPeriodType = schedule
    ? getAdvanceType(schedule)
    : 'daily'

  // The navigator steps by whatever is on screen.
  const stepType: RotationPeriodType = span === 'week' ? 'weekly' : 'monthly'
  const rangeStart = getPeriodStart(viewDate, stepType)
  const rangeEnd = getPeriodEnd(viewDate, stepType)

  // Which single day the employee table reads. Today when today is on screen —
  // that is the question somebody opening this screen is usually asking — and
  // otherwise the first day of whatever range they navigated to, so the table
  // always describes a day the timeline above it is actually showing.
  const anchorDate = isWithinInterval(new Date(), {
    start: rangeStart,
    end: rangeEnd,
  })
    ? new Date()
    : rangeStart

  const timeline = schedule
    ? buildRotationTimeline(
        schedule,
        shifts,
        employees,
        teams,
        viewDate,
        advanceType,
        span
      )
    : null

  const rotation = schedule
    ? buildRotation(schedule, shifts, employees, teams, anchorDate, advanceType)
    : null

  function selectSchedule(id: string) {
    setScheduleId(id)
    const next = rotateSchedules.find((s) => s.id === id)
    if (next) setViewDate(scheduleStartDate(next.start_date))
  }

  function resetView() {
    if (schedule) setViewDate(scheduleStartDate(schedule.start_date))
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
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Schedule Rotation
            </h2>
            <p className='text-muted-foreground'>
              Automated shift sequencing across a schedule&apos;s rotation.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Select value={schedule?.id ?? ''} onValueChange={selectSchedule}>
              <SelectTrigger className='w-56'>
                <SelectValue placeholder='Select a schedule' />
              </SelectTrigger>
              <SelectContent>
                {rotateSchedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant='outline' size='sm' asChild>
              <Link
                to='/schedule-rotation/assign'
                search={schedule ? { scheduleId: schedule.id } : {}}
              >
                <Users className='me-1 size-4' />
                Assign crews
              </Link>
            </Button>

            <Tabs
              value={span}
              onValueChange={(value) => setSpan(value as TimelineSpan)}
            >
              <TabsList>
                {SPAN_OPTIONS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {!schedule || !rotation || !timeline ? (
          <EmptyState
            icon={<CalendarDays className='size-8' />}
            title='No rotating schedules yet'
            description='Create a schedule of type “Rotate” to see its shift rotation here.'
          />
        ) : (
          <div className='flex flex-1 flex-col gap-6'>
            {/* Date navigator */}
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
              <Button variant='ghost' size='sm' onClick={resetView}>
                <RotateCcw className='me-1 size-3.5' />
                Reset
              </Button>
            </div>

            {timeline.rows.length === 0 ? (
              <EmptyState
                icon={<Users className='size-8' />}
                title='No employees on this rotation'
                description='Use “Assign crews” above to put employees or teams on each position of the cycle.'
              />
            ) : (
              <>
                <RotationTimelineGrid timeline={timeline} />

                {/* The same roster read the other way round — per person
                    rather than per crew, for one day of the range above. */}
                <section className='flex flex-col gap-3'>
                  <div className='flex flex-wrap items-baseline justify-between gap-2'>
                    <h3 className='text-lg font-semibold tracking-tight'>
                      Employees
                    </h3>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='text-xs font-medium text-muted-foreground'>
                        Cycle:
                      </span>
                      {rotation.positions.map((position) => (
                        <span
                          key={position.index}
                          className='flex items-center gap-1.5'
                        >
                          <span className='font-mono text-xs font-semibold text-muted-foreground'>
                            {position.letter}
                          </span>
                          <ShiftBadge position={position} />
                        </span>
                      ))}
                    </div>
                  </div>

                  <ScheduleRotationTable
                    rows={rotation.rows}
                    assignedHeading={`Assigned Shift · ${format(anchorDate, 'EEE, MMM d')}`}
                    cycleLength={rotation.cycleLength}
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

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-center'>
      <div className='text-muted-foreground'>{icon}</div>
      <p className='font-medium'>{title}</p>
      <p className='max-w-sm text-sm text-muted-foreground'>{description}</p>
    </div>
  )
}
