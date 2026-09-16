import { type ReactNode } from 'react'
import { type Control, useWatch } from 'react-hook-form'
import { TriangleAlert } from 'lucide-react'
import { plural } from '@/lib/plural'
import { useTimeFormat } from '@/lib/time-format'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { ShiftDaysTable } from '@/features/shifts/components/shift-days-table'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import {
  CYCLE_TYPE_OPTIONS,
  MONTHS,
  REGULAR_TYPE_OPTIONS,
  SCHEDULE_TYPES,
} from '../../data/data'
import { type CrewKind } from '../../data/schema'
import { crewsOnMultipleShifts, shiftCrewIds } from '../../fixed-schedule'
import { occurrenceLabels } from '../../occurrence-pattern'
import { calculateHours, formatTimes } from '../../utils'
import { AssignToStatusNote } from './assign-to-status-note'
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

// `inline` sits the value right after its label instead of the opposite edge.
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

// The three end-settings shapes never coexist, so one line covers all of them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatEndSettings(endSettings: any): string | undefined {
  if (!endSettings?.end_type) return undefined
  if (endSettings.end_type === 'after_occurrences') {
    return endSettings.end_occurrences
      ? `After ${endSettings.end_occurrences} occurrence(s)`
      : undefined
  }
  if (endSettings.end_type === 'on_date') {
    return endSettings.end_date ? `On ${endSettings.end_date}` : undefined
  }
  return 'Never ends'
}

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

// Legacy `parent_type: 'daily'` schedules only — view/edit of pre-existing
// data, the wizard can't create these anymore.
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

// Mirrors the "Shifts" step's own display — `ShiftDaysTable` collapses
// identical consecutive days into "Mon → Fri".
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
        const color = SHIFT_BADGE_COLOR_OPTIONS.find(
          (o) => o.value === shift.badge_color
        )
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
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  color?.swatchClassName
                )}
              />
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

// Rotate — who was picked, plus a crew count rather than a copy of the
// coverage grid. Fixed — who works each shift.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AssignToSummary({ values }: { values: any }) {
  const teams = useTeamsStore((s) => s.teams)
  const employees = useEmployeesStore((s) => s.employees)
  const shifts = useShiftsStore((s) => s.shifts)
  const kind: CrewKind = values.crew_kind ?? 'team'
  const isTeam = kind === 'team'
  const nameOf = (id: string) =>
    isTeam
      ? teams.find((team) => team.id === id)?.name
      : (() => {
          const employee = employees.find((e) => e.id === id)
          return employee ? getEmployeeFullName(employee) : undefined
        })()
  const names = (ids: string[]) => ids.map((id) => nameOf(id) ?? id).join(', ')

  if (values.type === 'fixed') {
    const shared = crewsOnMultipleShifts(values.shift_assignments, kind)
    return (
      <SummarySection title='Assign to'>
        {(values.shift_ids ?? []).map((shiftId: string) => (
          <SummaryRow
            key={shiftId}
            inline
            label={shifts.find((s) => s.id === shiftId)?.name ?? 'Shift'}
            value={names(shiftCrewIds(values.shift_assignments, shiftId, kind))}
          />
        ))}
        {shared.size > 0 && (
          <p className='flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400'>
            <TriangleAlert className='size-4 shrink-0' />
            {plural(shared.size, isTeam ? 'team' : 'employee')} on more than one
            shift: {names([...shared.keys()])}
          </p>
        )}
      </SummarySection>
    )
  }

  return (
    <SummarySection title='Assign to'>
      <SummaryRow
        inline
        label={isTeam ? 'Teams' : 'Employees'}
        value={names(values.crew_ids ?? [])}
      />
      <AssignToStatusNote dayCoverage={values.day_coverage} />
    </SummarySection>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeRule(rule: any): string {
  const interval = rule.interval || 1
  const unit =
    rule.frequency === 'daily'
      ? 'day'
      : rule.frequency === 'weekly'
        ? 'week'
        : 'month'
  const every = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`
  if (rule.frequency === 'daily') return every
  const days = occurrenceLabels(rule).join(', ')
  return days ? `${every} on ${days}` : every
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OccurrenceSummary({ values }: { values: any }) {
  const shifts = useShiftsStore((s) => s.shifts)
  const rules = values.shift_occurrences ?? []
  const exceptions = [
    values.occurrence_exceptions?.public_holiday && 'Public holiday',
    values.occurrence_exceptions?.sick_leave && 'Sick leave',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <SummarySection title='Occurrence'>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {rules.map((rule: any) => {
        const shift = shifts.find((s) => s.id === rule.shift_id)
        return (
          <div
            key={rule.shift_id}
            className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm'
          >
            <ShiftSwatch shift={shift} />
            <span className='text-muted-foreground'>
              {shift?.name ?? 'Shift'}
            </span>
            <span className='font-medium'>{describeRule(rule)}</span>
          </div>
        )
      })}
      <SummaryRow inline label='Exceptions' value={exceptions || 'None'} />
    </SummarySection>
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
          {values.type === 'fixed' && <OccurrenceSummary values={values} />}
          {(values.type === 'rotate' || values.type === 'fixed') && (
            <AssignToSummary values={values} />
          )}
          <SummarySection title='Calendar preview'>
            {values.type === 'rotate' && !values.day_coverage?.length && (
              // Without a placed roster there's only the template to walk.
              <p className='text-xs text-muted-foreground'>
                The pattern on real dates. Crews are placed on each shift from
                Work schedule → Assign crews; once they are, this shows who
                works what.
              </p>
            )}
            <ScheduleCalendarPreview values={values} />
          </SummarySection>
        </>
      )}
    </div>
  )
}
