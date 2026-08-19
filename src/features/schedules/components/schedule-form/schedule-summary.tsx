import { type ReactNode } from 'react'
import { type Control, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTimeFormat } from '@/lib/time-format'
import {
  CYCLE_LENGTH_UNIT_OPTIONS,
  CYCLE_TYPE_OPTIONS,
  MONTHS,
  RECURRENCE_END_TYPE_OPTIONS,
  REGULAR_TYPE_OPTIONS,
  SCHEDULE_TYPES,
} from '../../data/data'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_OPTIONS,
} from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { calculateHours } from '../../utils'

function SummarySection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-base font-semibold'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2 px-4'>{children}</CardContent>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium'>{value || '—'}</span>
    </div>
  )
}

function formatTimes(
  times: { from_time: string; to_time: string }[] | undefined,
  formatTime: (time: string) => string
) {
  if (!times?.length) return '—'
  return times
    .map((t) => `${formatTime(t.from_time)}–${formatTime(t.to_time)}`)
    .join(', ')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DailySummary({ values }: { values: any }) {
  const typeLabel =
    SCHEDULE_TYPES.find((t) => t.value === values.type)?.label ?? values.type
  const employees = values.employees ?? []
  const formatTime = useTimeFormat()

  return (
    <SummarySection title='Type'>
      <SummaryRow label='Schedule type' value={typeLabel} />
      <SummaryRow
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value={employees.map((e: any) => e.label).join(', ')}
        label='Employees'
      />

      {(values.type === 'weekly' || values.type === 'weekly_one') && (
        <div className='space-y-1 border-t pt-2'>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(values.days ?? []).map((d: any) => (
            <div
              key={d.day}
              className='flex items-center justify-between text-sm'
            >
              <span className='capitalize'>{d.day}</span>
              <span className='text-muted-foreground'>
                {formatTimes(d.times, formatTime)} · {calculateHours(d.times ?? [])}h
              </span>
            </div>
          ))}
        </div>
      )}

      {values.type === 'monthly' && (
        <div className='space-y-3 border-t pt-2'>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(values.months ?? []).map((m: any) => {
            const monthLabel = MONTHS.find(
              (mo) => Number(mo.value) === m.month
            )?.label
            return (
              <div key={m.month}>
                <p className='text-sm font-medium'>{monthLabel}</p>
                <div className='space-y-1 ps-2'>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(m.days ?? []).map((d: any) => (
                    <div
                      key={d.day}
                      className='flex items-center justify-between text-sm'
                    >
                      <span className='text-muted-foreground'>Day {d.day}</span>
                      <span className='text-muted-foreground'>
                        {formatTimes(d.times, formatTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SummarySection>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RegularBasicsSummary({ values }: { values: any }) {
  const typeLabel = REGULAR_TYPE_OPTIONS.find(
    (o) => o.value === values.type
  )?.label

  return (
    <SummarySection title='Type'>
      <SummaryRow label='Schedule type' value={typeLabel} />
      <SummaryRow label='Start date' value={values.start_date} />
    </SummarySection>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShiftDefinitionSummary({ values }: { values: any }) {
  const shifts = useShiftsStore((s) => s.shifts)
  const formatTime = useTimeFormat()
  const resolvedShifts: Shift[] = (
    (values.shift_ids as string[] | undefined)
      ?.map((id) => shifts.find((s) => s.id === id))
      .filter((s): s is Shift => s !== undefined) ?? []
  )

  return (
    <SummarySection title='Shifts'>
      <SummaryRow label='Nb. of shifts' value={resolvedShifts.length} />
      {resolvedShifts.length === 0 && (
        <p className='text-sm text-muted-foreground'>No shifts selected</p>
      )}
      {resolvedShifts.map((shift, i) => {
        const badgeLabel = SHIFT_BADGE_COLOR_OPTIONS.find(
          (o) => o.value === shift.badge_color
        )?.label
        const iconLabel = SHIFT_ICON_OPTIONS.find(
          (o) => o.value === shift.icon
        )?.label

        const enabledDays = shift.days.filter((d) => d.enabled)
        const totalHours = enabledDays.reduce(
          (sum, d) => sum + calculateHours(d.times),
          0
        )

        return (
          <div key={shift.id ?? i} className='space-y-1 border-t pt-2'>
            <p className='text-sm font-medium'>
              {shift.name || `Shift ${i + 1}`}
              <span className='font-normal text-muted-foreground'>
                {shift.short_code && `(${shift.short_code})`}
              </span>
            </p>
            <SummaryRow label='Badge color' value={badgeLabel} />
            <SummaryRow label='Icon' value={iconLabel} />
            <SummaryRow
              label='Weekly hours'
              value={totalHours ? `${totalHours}h` : undefined}
            />
            {enabledDays.length > 0 && (
              <div className='space-y-1 ps-2'>
                {enabledDays.map((d) => (
                  <div
                    key={d.day}
                    className='flex items-center justify-between text-sm'
                  >
                    <span className='text-muted-foreground capitalize'>
                      {d.day}
                    </span>
                    <span className='text-muted-foreground'>
                      {formatTimes(d.times, formatTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {shift.days.some((d) => d.times.some((t) => t.overnight)) && (
              <p className='text-xs text-muted-foreground'>Check next day</p>
            )}
          </div>
        )
      })}
    </SummarySection>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RotateSummary({ values }: { values: any }) {
  const shifts = useShiftsStore((s) => s.shifts)
  const cycleTypeLabel = CYCLE_TYPE_OPTIONS.find(
    (o) => o.value === values.cycle_type
  )?.label
  const cycleUnitLabel = CYCLE_LENGTH_UNIT_OPTIONS.find(
    (o) => o.value === values.cycle_length?.unit
  )?.label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pattern = (values.pattern ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftRepeat = (values.shift_repeat ?? []) as any[]

  return (
    <SummarySection title='Rotate config'>
      <SummaryRow label='Cycle type' value={cycleTypeLabel} />
      {values.cycle_type !== 'custom_shifts' && (
        <SummaryRow
          label='Cycle length'
          value={
            values.cycle_length
              ? `${cycleUnitLabel} · ${values.cycle_length.days} day(s)`
              : undefined
          }
        />
      )}
      {values.cycle_type === 'custom_shifts' &&
        shiftRepeat.length > 0 && (
          <div className='space-y-1 border-t pt-2'>
            {shiftRepeat.map((r) => {
              const shift = shifts.find((s) => s.id === r.shift_id)
              const unitLabel =
                r.frequency === 'daily'
                  ? 'Day(s)'
                  : r.frequency === 'weekly'
                    ? 'Week(s)'
                    : 'Month(s)'
              return (
                <SummaryRow
                  key={r.shift_id}
                  label={shift?.name ?? 'Shift'}
                  value={`Every ${r.interval} ${unitLabel}`}
                />
              )
            })}
            <SummaryRow
              label='Total pattern length'
              value={`${pattern.length} card(s)`}
            />
          </div>
        )}

      {pattern.length > 0 && (
        <div className='space-y-1 border-t pt-2'>
          {pattern.map((p) => (
            <div
              key={p.position}
              className='flex items-center justify-between text-sm'
            >
              <span>Day {p.position}</span>
              <span className='text-muted-foreground'>
                {p.is_off
                  ? 'Day off'
                  : (shifts.find((s) => s.id === p.shift_id)?.name ??
                    'Unassigned')}
              </span>
            </div>
          ))}
        </div>
      )}
    </SummarySection>
  )
}

function RegularSummary({
  values,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: any
}) {
  const endSettings = values.end_settings

  return (
    <>
      <RegularBasicsSummary values={values} />

      <ShiftDefinitionSummary values={values} />
      {values.type === 'rotate' && <RotateSummary values={values} />}

      {endSettings && (
        <SummarySection title='Occurrence'>
          <SummaryRow
            label='End'
            value={
              RECURRENCE_END_TYPE_OPTIONS.find((o) => o.value === endSettings.end_type)
                ?.label ?? endSettings.end_type
            }
          />
          {endSettings.end_type === 'after_occurrences' && (
            <SummaryRow
              label='Occurrences'
              value={endSettings.end_occurrences}
            />
          )}
          {endSettings.end_type === 'on_date' && (
            <SummaryRow label='End date' value={endSettings.end_date} />
          )}
        </SummarySection>
      )}
    </>
  )
}

type ScheduleSummaryProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
}

export function ScheduleSummary({ control }: ScheduleSummaryProps) {
  const values = useWatch({ control })

  return (
    <div className='space-y-4'>
      <SummarySection title='Basics'>
        <SummaryRow label='Name' value={values.name} />
        <SummaryRow label='Description' value={values.description} />
        <SummaryRow
          label='Type'
          value={values.parent_type === 'regular' ? 'Regular' : 'Daily'}
        />
      </SummarySection>

      {values.parent_type === 'daily' && <DailySummary values={values} />}
      {values.parent_type === 'regular' && <RegularSummary values={values} />}
    </div>
  )
}
