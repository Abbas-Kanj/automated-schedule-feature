import { type ReactNode } from 'react'
import { type Control, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BADGE_COLOR_OPTIONS,
  CYCLE_LENGTH_UNIT_OPTIONS,
  CYCLE_TYPE_OPTIONS,
  MONTHS,
  POLICY_TYPE_OPTIONS,
  RECURRENCE_END_TYPE_OPTIONS,
  RECURRENCE_FREQUENCY_OPTIONS,
  REGULAR_TYPE_OPTIONS,
  ROTATE_TYPE_OPTIONS,
  SCHEDULE_ICON_OPTIONS,
  SCHEDULE_TYPES,
} from '../../data/data'
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
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
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

function formatTimes(times?: { from_time: string; to_time: string }[]) {
  if (!times?.length) return '—'
  return times.map((t) => `${t.from_time}–${t.to_time}`).join(', ')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DailySummary({ values }: { values: any }) {
  const typeLabel =
    SCHEDULE_TYPES.find((t) => t.value === values.type)?.label ?? values.type
  const employees = values.employees ?? []

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
                {formatTimes(d.times)} · {calculateHours(d.times ?? [])}h
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
                        {formatTimes(d.times)}
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
  const badgeLabel = BADGE_COLOR_OPTIONS.find(
    (o) => o.value === values.badge_color
  )?.label
  const iconLabel = SCHEDULE_ICON_OPTIONS.find(
    (o) => o.value === values.icon
  )?.label
  const policyLabel = POLICY_TYPE_OPTIONS.find(
    (o) => o.value === values.policy_type
  )?.label

  return (
    <SummarySection title='Type'>
      <SummaryRow label='Schedule type' value={typeLabel} />
      <SummaryRow label='Badge color' value={badgeLabel} />
      <SummaryRow label='Icon' value={iconLabel} />
      <SummaryRow
        label='Active status'
        value={values.is_active ? 'Active' : 'Inactive'}
      />
      <SummaryRow label='Policy type' value={policyLabel} />
      <SummaryRow label='Start date' value={values.start_date} />
    </SummarySection>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShiftDefinitionSummary({ values }: { values: any }) {
  return (
    <SummarySection title='Shifts'>
      <SummaryRow label='Nb. of shifts' value={values.nb_of_shifts} />
      <SummaryRow
        label='Temporary schedule'
        value={
          values.temporary_schedule
            ? (values.temporary_schedule_label ?? 'Yes')
            : 'No'
        }
      />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(values.shifts ?? []).map((shift: any, i: number) => (
        <div key={shift.id ?? i} className='space-y-1 border-t pt-2'>
          <p className='text-sm font-medium'>
            {shift.name || `Shift ${i + 1}`}{' '}
            <span className='font-normal text-muted-foreground'>
              {shift.short_code && `(${shift.short_code})`}
            </span>
          </p>
          <div className='space-y-1 ps-2'>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(shift.days ?? []).map((d: any) => (
              <div
                key={d.day}
                className='flex items-center justify-between text-sm'
              >
                <span className='text-muted-foreground capitalize'>
                  {d.day}
                </span>
                <span className='text-muted-foreground'>
                  {formatTimes([d.time])}
                </span>
              </div>
            ))}
          </div>
          {shift.overnight && (
            <p className='text-xs text-muted-foreground'>Overnight shift</p>
          )}
        </div>
      ))}
    </SummarySection>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RotateSummary({ values }: { values: any }) {
  const cycleTypeLabel = CYCLE_TYPE_OPTIONS.find(
    (o) => o.value === values.cycle_type
  )?.label
  const cycleUnitLabel = CYCLE_LENGTH_UNIT_OPTIONS.find(
    (o) => o.value === values.cycle_length?.unit
  )?.label
  const rotateTypeLabel = ROTATE_TYPE_OPTIONS.find(
    (o) => o.value === values.rotate_type
  )?.label

  return (
    <SummarySection title='Rotate config'>
      <SummaryRow label='Cycle type' value={cycleTypeLabel} />
      <SummaryRow
        label='Cycle length'
        value={
          values.cycle_length
            ? `${cycleUnitLabel} · ${values.cycle_length.days} day(s)`
            : undefined
        }
      />
      <SummaryRow label='Rotate type' value={rotateTypeLabel} />
      <SummaryRow label='Shift block' value={values.shift_block} />
      <SummaryRow
        label='Shift length'
        value={
          values.shift_length_hours
            ? `${values.shift_length_hours}h/day`
            : undefined
        }
      />

      {(values.blocks?.length ?? 0) > 0 && (
        <div className='space-y-1 border-t pt-2'>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {values.blocks.map((b: any) => (
            <div
              key={b.id}
              className='flex items-center justify-between text-sm'
            >
              <span>{b.label}</span>
              <span className='text-muted-foreground'>
                {formatTimes([b.time])}
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
  const recurrence = values.recurrence
  const frequencyLabel = recurrence
    ? RECURRENCE_FREQUENCY_OPTIONS.find((o) => o.value === recurrence.frequency)
        ?.label
    : undefined
  const endTypeLabel = recurrence
    ? RECURRENCE_END_TYPE_OPTIONS.find((o) => o.value === recurrence.end_type)
        ?.label
    : undefined

  return (
    <>
      <RegularBasicsSummary values={values} />

      {values.type === 'rotate' ? (
        <RotateSummary values={values} />
      ) : (
        <ShiftDefinitionSummary values={values} />
      )}

      {recurrence && (
        <SummarySection title='Recurrence'>
          <SummaryRow label='Frequency' value={frequencyLabel} />
          <SummaryRow label='Repeat every' value={recurrence.interval} />
          {(recurrence.frequency === 'daily' ||
            recurrence.frequency === 'weekly') && (
            <SummaryRow
              label='Repeat on'
              value={(recurrence.weekdays ?? [])
                .map((d: string) => d.charAt(0).toUpperCase() + d.slice(1))
                .join(', ')}
            />
          )}
          {recurrence.frequency === 'monthly' && (
            <SummaryRow
              label='Day of month'
              value={
                recurrence.day_of_month_from != null
                  ? `${recurrence.day_of_month_from}–${recurrence.day_of_month_to}`
                  : undefined
              }
            />
          )}
          <SummaryRow label='End' value={endTypeLabel} />
          {recurrence.end_type === 'after_occurrences' && (
            <SummaryRow
              label='Occurrences'
              value={recurrence.end_occurrences}
            />
          )}
          {recurrence.end_type === 'on_date' && (
            <SummaryRow label='End date' value={recurrence.end_date} />
          )}
          <SummaryRow
            label='Public holiday exception'
            value={recurrence.exceptions?.public_holiday ? 'Yes' : 'No'}
          />
          <SummaryRow
            label='Sick leave exception'
            value={recurrence.exceptions?.sick_leave ? 'Yes' : 'No'}
          />
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
