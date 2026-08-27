import { type ReactNode, useMemo, useState } from 'react'
import { parse } from 'date-fns'
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
import { ScheduleRotationTable } from './components/schedule-rotation-table'
import { ShiftBadge } from './components/shift-badge'
import { PERIOD_OPTIONS } from './data'
import {
  type RotationPeriodType,
  buildRotation,
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
  const [periodType, setPeriodType] = useState<RotationPeriodType>('weekly')

  const schedule =
    rotateSchedules.find((s) => s.id === scheduleId) ?? rotateSchedules[0]

  const [viewDate, setViewDate] = useState<Date>(() =>
    schedule ? scheduleStartDate(schedule.start_date) : new Date()
  )

  const rotation = schedule
    ? buildRotation(schedule, shifts, employees, teams, viewDate, periodType)
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

            <Tabs
              value={periodType}
              onValueChange={(value) =>
                setPeriodType(value as RotationPeriodType)
              }
            >
              <TabsList>
                {PERIOD_OPTIONS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {!schedule || !rotation ? (
          <EmptyState
            icon={<CalendarDays className='size-8' />}
            title='No rotating schedules yet'
            description='Create a schedule of type “Rotate” to see its shift rotation here.'
          />
        ) : (
          <div className='flex flex-1 flex-col gap-4'>
            {/* Date navigator */}
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8'
                  onClick={() =>
                    setViewDate((d) => shiftPeriod(d, periodType, -1))
                  }
                  aria-label='Previous period'
                >
                  <ChevronLeft className='size-4' />
                </Button>
                <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                  <CalendarDays className='size-4' />
                  {rotation.rangeLabel}
                </div>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-8'
                  onClick={() =>
                    setViewDate((d) => shiftPeriod(d, periodType, 1))
                  }
                  aria-label='Next period'
                >
                  <ChevronRight className='size-4' />
                </Button>
              </div>
              <Button variant='ghost' size='sm' onClick={resetView}>
                <RotateCcw className='me-1 size-3.5' />
                Reset
              </Button>
            </div>

            {/* Cycle legend — decode the sequence letters */}
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground text-xs font-medium'>
                Cycle:
              </span>
              {rotation.positions.map((position) => (
                <span
                  key={position.index}
                  className='flex items-center gap-1.5'
                >
                  <span className='text-muted-foreground font-mono text-xs font-semibold'>
                    {position.letter}
                  </span>
                  <ShiftBadge position={position} />
                </span>
              ))}
            </div>

            {rotation.rows.length === 0 ? (
              <EmptyState
                icon={<Users className='size-8' />}
                title='No employees on this rotation'
                description='Assign employees or teams to this schedule’s shifts (each shift’s “Assign to” tab) to build the rotation roster.'
              />
            ) : (
              <ScheduleRotationTable
                rows={rotation.rows}
                periodType={periodType}
              />
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
      <p className='text-muted-foreground max-w-sm text-sm'>{description}</p>
    </div>
  )
}
