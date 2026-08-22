import { type ReactNode } from 'react'
import { type Control, useWatch } from 'react-hook-form'
import { useTimeFormat } from '@/lib/time-format'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShiftDaysTable } from '@/features/shifts/components/shift-days-table'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import {
  CYCLE_TYPE_OPTIONS,
  MONTHS,
  REGULAR_TYPE_OPTIONS,
  SCHEDULE_TYPES,
} from '../../data/data'
import { calculateHours, formatTimes } from '../../utils'
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

// "Never ends" / "After 4 occurrence(s)" / "On 2026-09-01" as one line —
// the three end-settings shapes never coexist, so they don't need three
// separate rows.
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
          <SummarySection title='Calendar preview'>
            <ScheduleCalendarPreview values={values} />
          </SummarySection>
        </>
      )}
    </div>
  )
}
