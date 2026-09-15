import { type ReactNode, useMemo, useState } from 'react'
import {
  eachDayOfInterval,
  format,
  isWithinInterval,
  parse,
} from 'date-fns'
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
import { type Team } from '@/features/teams/data/schema'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { AssignCrewsDialog } from './components/assign-crews-dialog'
import { RotationTimelineGrid } from './components/rotation-timeline'
import { ScheduleRotationTable } from './components/schedule-rotation-table'
import { ShiftBadge } from './components/shift-badge'
import { SPAN_OPTIONS } from './data'
import { type TimelineSpan, buildRotationTimeline } from './timeline'
import {
  type RotateSchedule,
  type RotationPeriodType,
  buildRotation,
  getAdvanceType,
  getAssignedIndex,
  getDefaultSpan,
  getPeriodEnd,
  getPeriodIndex,
  getPeriodStart,
  isRotateSchedule,
  shiftPeriod,
} from './utils'

function scheduleStartDate(startDate: string): Date {
  return parse(startDate, 'yyyy-MM-dd', new Date())
}

// Which cycle days each employee works, read off the schedule's own coverage
// matrix. Teams resolve to their members, since the table lists people.
function buildWorkDays(
  schedule: RotateSchedule | undefined,
  teams: Team[]
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  if (!schedule) return map
  const members = new Map(teams.map((team) => [team.id, team.employee_ids]))
  for (const cell of schedule.day_coverage) {
    const ids = [
      ...cell.employee_ids,
      ...cell.team_ids.flatMap((id) => members.get(id) ?? []),
    ]
    for (const id of ids) {
      const days = map.get(id) ?? new Set<number>()
      days.add(cell.day)
      map.set(id, days)
    }
  }
  return map
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
  // How much calendar each of the two views shows. They are separate because
  // they answer different questions — the grid is "how does this rotation
  // look", the table is "who is on" — and somebody comparing a month of bands
  // against this week's roster should not have to give one up for the other.
  // Both open on the span the schedule's own cycle is written in
  // (`getDefaultSpan`) and stay clickable afterwards.
  const [span, setSpan] = useState<TimelineSpan>(() =>
    rotateSchedules[0] ? getDefaultSpan(rotateSchedules[0]) : 'month'
  )
  const [employeeSpan, setEmployeeSpan] = useState<TimelineSpan>(() =>
    rotateSchedules[0] ? getDefaultSpan(rotateSchedules[0]) : 'month'
  )
  const [assignOpen, setAssignOpen] = useState(false)

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

  // Which cycle days the employees table's own period covers. The table is a
  // roster, so the useful filter is "who is actually on during this" — a
  // rotation long enough to have people idle for a whole week is exactly when
  // reading the full list stops being useful.
  const employeeStepType: RotationPeriodType =
    employeeSpan === 'week' ? 'weekly' : 'monthly'

  // Which cycle days each employee works, read off the schedule's own matrix.
  // Teams resolve to their members, since the table lists people.
  // Not memoized: the React Compiler is on, and a manual useMemo here is one
  // it declines to preserve.
  const workDaysByEmployee = buildWorkDays(schedule, teams)

  const employeeRows = (() => {
    if (!schedule || !rotation) return []
    const cycleLength = schedule.pattern.length
    if (!cycleLength) return rotation.rows

    const covered = new Set(
      eachDayOfInterval({
        start: getPeriodStart(viewDate, employeeStepType),
        end: getPeriodEnd(viewDate, employeeStepType),
      }).map((date) =>
          getAssignedIndex(
            0,
            getPeriodIndex(schedule, date, advanceType),
            cycleLength
          )
        )
    )

    return rotation.rows.filter((row) => {
      const worked = workDaysByEmployee.get(row.employeeId)
      // Somebody the matrix does not mention is left in rather than hidden —
      // an unexplained disappearance is worse than an extra row.
      if (!worked) return true
      return [...worked].some((day) => covered.has(day))
    })
  })()

  function selectSchedule(id: string) {
    setScheduleId(id)
    const next = rotateSchedules.find((s) => s.id === id)
    if (next) {
      setViewDate(scheduleStartDate(next.start_date))
      setSpan(getDefaultSpan(next))
      setEmployeeSpan(getDefaultSpan(next))
    }
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
              Rotating Work Schedule
            </h2>
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

            <Button
              variant='outline'
              size='sm'
              onClick={() => setAssignOpen(true)}
            >
              <Users className='me-1 size-4' />
              Assign crews
            </Button>
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
                <section className='flex flex-col gap-3'>
                  <div className='flex flex-wrap items-baseline justify-between gap-2'>
                    <h3 className='text-lg font-semibold tracking-tight'>
                      Timeline
                    </h3>
                    <SpanTabs value={span} onChange={setSpan} />
                  </div>

                  <RotationTimelineGrid timeline={timeline} />
                </section>

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
                      <SpanTabs
                        value={employeeSpan}
                        onChange={setEmployeeSpan}
                        className='ms-2'
                      />
                    </div>
                  </div>

                  {employeeRows.length === 0 ? (
                    <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                      Nobody on this rotation works during{' '}
                      {employeeSpan === 'week' ? 'this week' : 'this month'}.
                    </p>
                  ) : (
                    <ScheduleRotationTable
                      rows={employeeRows}
                      assignedHeading={`Assigned Shift · ${format(anchorDate, 'EEE, MMM d')}`}
                      cycleLength={rotation.cycleLength}
                    />
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </Main>

      {/* Mounted only while open so the picker re-seeds its default (the
          first unstaffed schedule) on every open, without an effect. */}
      {assignOpen && (
        <AssignCrewsDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          scheduleId={schedule?.id}
        />
      )}
    </>
  )
}

// The Weekly/Monthly control. Rendered per view rather than once for the page:
// the grid and the table are asking different questions and are allowed to be
// set to different spans while you compare them.
function SpanTabs({
  value,
  onChange,
  className,
}: {
  value: TimelineSpan
  onChange: (span: TimelineSpan) => void
  className?: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as TimelineSpan)}
      className={className}
    >
      <TabsList>
        {SPAN_OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
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
