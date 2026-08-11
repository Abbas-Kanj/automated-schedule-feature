import { type ReactNode } from 'react'
import { type Control, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MONTHS,
  POLICY_TYPE_OPTIONS,
  SCHEDULE_TYPES,
  SHIFT_CYCLE_OPTIONS,
  getShiftRotationOptions,
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

  return (
    <SummarySection title='Type'>
      <SummaryRow label='Schedule type' value={typeLabel} />

      {(values.type === 'weekly' || values.type === 'weekly_one') && (
        <div className='space-y-1 border-t pt-2'>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(values.days ?? []).map((d: any) => (
            <div key={d.day} className='flex items-center justify-between text-sm'>
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
function RegularSummary({ values }: { values: any }) {
  const isSingle = values.shift_number === 1 && values.split_number === 1

  return (
    <SummarySection title='Type'>
      <SummaryRow label='Shift number' value={values.shift_number} />
      <SummaryRow label='Split number' value={values.split_number} />

      {values.shift_number > 1 && (
        <>
          <SummaryRow
            label='Shift cycle'
            value={
              SHIFT_CYCLE_OPTIONS.find((o) => o.value === values.shift_cycle)
                ?.label
            }
          />
          <SummaryRow
            label='Shift rotation'
            value={
              values.shift_cycle
                ? getShiftRotationOptions(values.shift_cycle).find(
                    (o) => o.value === values.shift_rotation
                  )?.label
                : undefined
            }
          />
          <SummaryRow label='Repeated shift' value={values.repeated_shift} />
        </>
      )}

      {isSingle && values.single_shift && (
        <div className='space-y-1 border-t pt-2'>
          <div className='flex items-center justify-between text-sm'>
            <span>Days</span>
            <span className='text-muted-foreground capitalize'>
              {(values.single_shift.days ?? []).join(', ') || '—'}
            </span>
          </div>
          <div className='flex items-center justify-between text-sm'>
            <span>Shift time</span>
            <span className='text-muted-foreground'>
              {formatTimes([values.single_shift.time])}
            </span>
          </div>
          {values.single_shift.has_break && values.single_shift.break_time && (
            <div className='flex items-center justify-between text-sm'>
              <span>Break</span>
              <span className='text-muted-foreground'>
                {formatTimes([values.single_shift.break_time])}
                {values.single_shift.break_hours != null &&
                  ` (${values.single_shift.break_hours}h)`}
              </span>
            </div>
          )}
        </div>
      )}

      {!isSingle && values.shifts?.length > 0 && (
        <div className='space-y-3 border-t pt-2'>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {values.shifts.map((shift: any, i: number) => (
            <div key={i}>
              <p className='text-sm font-medium'>Shift {i + 1}</p>
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
                      {formatTimes(d.splits)}
                    </span>
                  </div>
                ))}
                {shift.has_break && (
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-muted-foreground'>Break</span>
                    <span className='text-muted-foreground'>
                      {formatTimes(shift.break_time ? [shift.break_time] : [])}
                      {shift.break_hours != null && ` (${shift.break_hours}h)`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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

      {values.parent_type === 'regular' && (
        <SummarySection title='Policy'>
          <SummaryRow
            label='Policy type'
            value={
              POLICY_TYPE_OPTIONS.find((o) => o.value === values.policy_type)
                ?.label
            }
          />
          <SummaryRow
            label='Leave equivalent hours per day'
            value={values.leave_hours ? `${values.leave_hours}h` : undefined}
          />
          <SummaryRow
            label='Official holiday equivalent hours per day'
            value={
              values.official_holiday_hours
                ? `${values.official_holiday_hours}h`
                : undefined
            }
          />
        </SummarySection>
      )}
    </div>
  )
}
