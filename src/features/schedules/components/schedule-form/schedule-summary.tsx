import { type ReactNode, useMemo } from 'react'
import { format, parse } from 'date-fns'
import { type Control, useWatch } from 'react-hook-form'
import { useTimeFormat } from '@/lib/time-format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { ShiftDaysTable } from '@/features/shifts/components/shift-days-table'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { SHIFT_ICON_COMPONENTS } from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import {
  CYCLE_TYPE_OPTIONS,
  MONTHS,
  REGULAR_TYPE_OPTIONS,
  SCHEDULE_TYPES,
} from '../../data/data'
import {
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type RotatePatternEntry,
} from '../../data/schema'
import {
  crewsFromDayCoverage,
  dayCoverageMatchesPlacements,
  orderShiftIdsByStart,
  patternToSlots,
  shiftHoursById,
} from '../../rotation-crews'
import { analyzeDayCoverage, crewRequirement } from '../../rotation-suggestion'
import { calculateHours, formatEndSettings, formatTimes } from '../../utils'
import { RotationCoveragePanel } from './rotation-coverage-panel'
import { CrewStartSummary } from './rotation-crew-starts'
import { ScheduleCalendarPreview } from './schedule-calendar-preview'

function SummarySection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card className='gap-2 py-3'>
      <CardHeader className='px-4'>
        <CardTitle className='text-sm font-semibold'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-1.5 px-4'>{children}</CardContent>
    </Card>
  )
}

// `inline` sits the value right after its label instead of pushing it to
// the opposite edge — used by the Basics block, whose values are short
// enough that a full-width gap just makes them harder to pair up.
function SummaryRow({
  label,
  value,
  inline,
}: {
  label: string
  value: ReactNode
  inline?: boolean
}) {
  if (inline) {
    return (
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm'>
        <span className='text-muted-foreground'>{label}</span>
        <span className='font-medium'>{value || '—'}</span>
      </div>
    )
  }
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-end font-medium'>{value || '—'}</span>
    </div>
  )
}

// Everything identifying the schedule — name/description, both type levels
// (parent + specific), rotate's own pattern type, and the start/end dates —
// in a single block, so the reader isn't hopping between cards for what is
// really one set of facts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BasicsSummary({ values }: { values: any }) {
  const isRegular = values.parent_type === 'regular'
  const typeLabel = isRegular
    ? REGULAR_TYPE_OPTIONS.find((o) => o.value === values.type)?.label
    : (SCHEDULE_TYPES.find((t) => t.value === values.type)?.label ??
      values.type)
  const rotateTypeLabel = CYCLE_TYPE_OPTIONS.find(
    (o) => o.value === values.cycle_type
  )?.label
  const employees = values.employees ?? []

  return (
    <SummarySection title='Basics'>
      <SummaryRow inline label='Name' value={values.name} />
      <SummaryRow inline label='Description' value={values.description} />
      <SummaryRow inline label='Type' value={isRegular ? 'Regular' : 'Daily'} />
      <SummaryRow inline label='Schedule type' value={typeLabel} />
      {isRegular && values.type === 'rotate' && (
        <SummaryRow inline label='Rotate type' value={rotateTypeLabel} />
      )}
      {isRegular && (
        <>
          <SummaryRow inline label='Start date' value={values.start_date} />
          <SummaryRow
            inline
            label='Ends'
            value={formatEndSettings(values.end_settings)}
          />
        </>
      )}
      {!isRegular && (
        <SummaryRow
          inline
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value={employees.map((e: any) => e.label).join(', ')}
          label='Employees'
        />
      )}
    </SummarySection>
  )
}

// Legacy `parent_type: 'daily'` schedules only (view/edit of pre-existing
// data — see `schedule-form.tsx`); the wizard can't create these anymore.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DailyDaysSummary({ values }: { values: any }) {
  const formatTime = useTimeFormat()

  if (values.type === 'weekly' || values.type === 'weekly_one') {
    return (
      <SummarySection title='Days'>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(values.days ?? []).map((d: any) => (
          <SummaryRow
            key={d.day}
            label={d.day.charAt(0).toUpperCase() + d.day.slice(1)}
            value={`${formatTimes(d.times, formatTime)} · ${calculateHours(
              d.times ?? []
            )}h`}
          />
        ))}
      </SummarySection>
    )
  }

  return (
    <SummarySection title='Months'>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(values.months ?? []).map((m: any) => {
        const monthLabel = MONTHS.find(
          (mo) => Number(mo.value) === m.month
        )?.label
        return (
          <div
            key={m.month}
            className='space-y-1 border-t pt-1.5 first:border-t-0 first:pt-0'
          >
            <p className='text-sm font-medium'>{monthLabel}</p>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(m.days ?? []).map((d: any) => (
              <SummaryRow
                key={d.day}
                label={`Day ${d.day}`}
                value={formatTimes(d.times, formatTime)}
              />
            ))}
          </div>
        )
      })}
    </SummarySection>
  )
}

// Each selected shift exactly the way the "Shifts" step already shows it —
// name + colour/icon, weekly hours, then the same collapsed "Day | Times"
// table (`ShiftDaysTable`: identical consecutive days collapse into
// "Mon → Fri", differing ones stay their own rows). Badge colour and icon
// get no label rows of their own; the swatch and glyph already say it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShiftsSummary({ values }: { values: any }) {
  const shifts = useShiftsStore((s) => s.shifts)
  const formatTime = useTimeFormat()
  const resolvedShifts: Shift[] =
    (values.shift_ids as string[] | undefined)
      ?.map((id) => shifts.find((s) => s.id === id))
      .filter((s): s is Shift => s !== undefined) ?? []

  return (
    <SummarySection title={`Shifts (${resolvedShifts.length})`}>
      {resolvedShifts.length === 0 && (
        <p className='text-sm text-muted-foreground'>No shifts selected</p>
      )}
      {resolvedShifts.map((shift, i) => {
        const Icon = SHIFT_ICON_COMPONENTS[shift.icon]
        const enabledDays = shift.days.filter((d) => d.enabled)
        const totalHours = enabledDays.reduce(
          (sum, d) => sum + calculateHours(d.times),
          0
        )
        const hasOvernight = shift.days.some((d) =>
          d.times.some((t) => t.overnight)
        )

        return (
          <div
            key={shift.id ?? i}
            className='space-y-1.5 border-t pt-2 first:border-t-0 first:pt-0'
          >
            <div className='flex items-center gap-2'>
              <ShiftSwatch shift={shift} size='md' />
              {Icon && (
                <Icon className='size-4 shrink-0 text-muted-foreground' />
              )}
              <span className='truncate text-sm font-medium'>
                {shift.name || `Shift ${i + 1}`}
              </span>
              {shift.short_code && (
                <span className='shrink-0 text-xs text-muted-foreground'>
                  ({shift.short_code})
                </span>
              )}
              <span className='ms-auto shrink-0 text-xs text-muted-foreground'>
                {totalHours ? `${totalHours}h` : '—'}
              </span>
            </div>
            {enabledDays.length ? (
              <ShiftDaysTable days={enabledDays} formatTime={formatTime} />
            ) : (
              <p className='text-sm text-muted-foreground'>No enabled days</p>
            )}
            {hasOvernight && (
              <p className='text-xs text-muted-foreground'>Check next day</p>
            )}
          </div>
        )
      })}
    </SummarySection>
  )
}

// Rotate only: the roster, read back the way the "Assign to" step showed it.
//
// It is the same coverage grid rather than a list, because a list of who works
// where under-reports a rotation badly — the interesting fact is whether every
// selected shift is covered on every day of the cycle, and that is a grid-
// shaped fact. Below it, each crew's own cycle is spelled out in one line.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AssignToSummary({ values }: { values: any }) {
  const shifts = useShiftsStore((s) => s.shifts)
  const employees = useEmployeesStore((s) => s.employees)
  const teams = useTeamsStore((s) => s.teams)
  const pattern = useMemo(
    () => (values.pattern ?? []) as RotatePatternEntry[],
    [values.pattern]
  )
  const dayCoverage = useMemo(
    () => (values.day_coverage ?? []) as RotateDayCoverage[],
    [values.day_coverage]
  )
  const crewPlacements = useMemo(
    () => (values.crew_placements ?? []) as RotateCrewPlacement[],
    [values.crew_placements]
  )
  const shiftIds = useMemo(
    () => (values.shift_ids ?? []) as string[],
    [values.shift_ids]
  )
  // The weekday and weekend checks are the reason this is parsed here: they
  // are the only part of the analysis that depends on real dates, and without
  // a start date they are silently skipped — which is how this screen used to
  // drop them while the "Assign to" step showed them.
  const startDate = useMemo(() => {
    const raw = values.start_date as string | undefined
    if (!raw) return undefined
    const parsed = parse(raw, 'yyyy-MM-dd', new Date())
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [values.start_date])

  const employeeLabels = useMemo(
    () =>
      new Map(
        employees
          .filter((employee) => employee.id)
          .map((employee) => [
            employee.id as string,
            getEmployeeFullName(employee),
          ])
      ),
    [employees]
  )

  const orderedShiftIds = useMemo(
    () => orderShiftIdsByStart(shiftIds, shifts),
    [shiftIds, shifts]
  )
  const crews = useMemo(
    () => crewsFromDayCoverage(dayCoverage, teams, employeeLabels),
    [dayCoverage, teams, employeeLabels]
  )
  const shiftLabels = useMemo(
    () => new Map(shifts.map((shift) => [shift.id, shift.name])),
    [shifts]
  )
  const shiftHours = useMemo(() => shiftHoursById(shifts), [shifts])
  // Same requirement the "Assign to" step computes, so the panel repeated
  // here grades the roster identically instead of calling a structural hole
  // fixable on one screen and not the other.
  const requirement = useMemo(
    () => crewRequirement(patternToSlots(pattern), orderedShiftIds),
    [pattern, orderedShiftIds]
  )
  // Every option the step passes, for the same reason: a summary that grades
  // more leniently than the screen it summarises is worse than no summary.
  const analysis = useMemo(
    () =>
      analyzeDayCoverage(crews, orderedShiftIds, pattern.length, {
        startDate,
        shiftLabels,
        shiftHours,
        minimumCrews: requirement.exact ? requirement.minimumCrews : undefined,
      }),
    [
      crews,
      orderedShiftIds,
      pattern.length,
      startDate,
      shiftLabels,
      shiftHours,
      requirement,
    ]
  )
  const placementsDescribeCoverage = useMemo(
    () =>
      dayCoverageMatchesPlacements(
        patternToSlots(pattern),
        crewPlacements,
        orderedShiftIds,
        dayCoverage
      ),
    [pattern, crewPlacements, orderedShiftIds, dayCoverage]
  )

  return (
    <SummarySection title='Assign to'>
      {pattern.length === 0 && (
        <p className='text-sm text-muted-foreground'>No pattern to assign</p>
      )}
      {pattern.length > 0 && crews.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          Nobody is on this rotation yet
        </p>
      )}
      {crews.length > 0 && (
        <>
          <CrewStartSummary
            placements={crewPlacements}
            crews={crews}
            cycleLength={pattern.length}
            shifts={shifts}
            describesCoverage={placementsDescribeCoverage}
          />
          <RotationCoveragePanel
            crews={crews}
            analysis={analysis}
            orderedShiftIds={orderedShiftIds}
            cycleLength={pattern.length}
            shifts={shifts}
          />
          <p className='text-xs text-muted-foreground'>
            The cycle repeats from its start date, so each crew works the row
            above over and over. A shift showing 0 on a day is nobody covering
            it that day.
          </p>
        </>
      )}
    </SummarySection>
  )
}

// Rotate only: the wizard has no "Start & End" step (see `getSteps` in
// `schedule-form.tsx`) — those live on the Schedule Rotation screen, next to
// the cycle they shift. A rotate schedule is therefore *always* saved with
// some start date, so the one thing the Summary has to do is say where it
// came from and where to change it; silently showing "today / never ends" as
// if it had been chosen is how a schedule starts on the wrong day.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RotateDatesNotice({ values }: { values: any }) {
  const isStillDefault =
    values.start_date === format(new Date(), 'yyyy-MM-dd') &&
    (values.end_settings?.end_type ?? 'never') === 'never'

  return (
    <div className='rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm'>
      <p className='font-medium'>Start and end are set on Schedule Rotation</p>
      <p className='text-muted-foreground'>
        {isStillDefault
          ? 'Not set yet — this schedule will start today and never end. Open Schedule Rotation after saving to set its real start date and end.'
          : 'Change this rotation’s start date or end on the Schedule Rotation screen.'}
      </p>
    </div>
  )
}

type ScheduleSummaryProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
}

export function ScheduleSummary({ control }: ScheduleSummaryProps) {
  const values = useWatch({ control })

  return (
    <div className='space-y-3'>
      <BasicsSummary values={values} />

      {values.parent_type === 'daily' && <DailyDaysSummary values={values} />}

      {values.parent_type === 'regular' && (
        <>
          <ShiftsSummary values={values} />
          {values.type === 'rotate' && <RotateDatesNotice values={values} />}
          {values.type === 'rotate' && <AssignToSummary values={values} />}
          <SummarySection title='Calendar preview'>
            {values.type === 'rotate' && (
              // The preview walks the *pattern*, which is one crew's journey
              // — so it shows one shift a day even when the schedule runs
              // several. Who covers the rest is the grid above, not this.
              <p className='text-xs text-muted-foreground'>
                One crew&apos;s cycle on real dates. The other selected shifts
                run on the same days, covered by the other crews — see “Assign
                to” above.
              </p>
            )}
            <ScheduleCalendarPreview values={values} />
          </SummarySection>
        </>
      )}
    </div>
  )
}
