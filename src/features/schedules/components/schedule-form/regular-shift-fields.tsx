import { useEffect } from 'react'
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SelectDropdown } from '@/components/select-dropdown'
import { getShiftRotationOptions, SHIFT_CYCLE_OPTIONS } from '../../data/data'
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type RegularShiftDay,
  type ShiftCycle,
} from '../../data/schema'
import { calculateHours } from '../../utils'
import { TimeRangeFields } from './time-range-fields'

const DEFAULT_TIME = { from_time: '09:00', to_time: '17:00' }

function makeSplits(count: number) {
  return Array.from({ length: count }, () => ({ ...DEFAULT_TIME }))
}

type RegularShiftFieldsProps = {
  disabled?: boolean
}

export function RegularShiftFields({ disabled }: RegularShiftFieldsProps) {
  const { control, getValues, setValue } = useFormContext<any>()
  const shiftNumber = Number(useWatch({ control, name: 'shift_number' })) || 0
  const splitNumber = Number(useWatch({ control, name: 'split_number' })) || 0
  const isSingle = shiftNumber === 1 && splitNumber === 1

  const { fields: shiftFields, replace } = useFieldArray({
    control,
    name: 'shifts',
  })

  useEffect(() => {
    if (isSingle || !shiftNumber || !splitNumber) return

    const current =
      (getValues('shifts') as
        | {
            days: RegularShiftDay[]
            has_break?: boolean
            break_hours?: number
          }[]
        | undefined) ?? []
    const next = Array.from({ length: shiftNumber }, (_, i) => {
      const existingDays = current[i]?.days ?? []
      const days = existingDays.map((d) => ({
        day: d.day,
        splits:
          d.splits.length === splitNumber
            ? d.splits
            : Array.from(
                { length: splitNumber },
                (_, k) => d.splits[k] ?? { ...DEFAULT_TIME }
              ),
      }))
      return {
        days,
        has_break: current[i]?.has_break ?? false,
        break_hours: current[i]?.break_hours,
      }
    })
    replace(next)
  }, [shiftNumber, splitNumber, isSingle])

  useEffect(() => {
    if (!isSingle) return
    if (!getValues('single_shift')) {
      setValue('single_shift', {
        days: [],
        time: { ...DEFAULT_TIME },
        has_break: false,
      })
    }
  }, [isSingle])

  if (!shiftNumber || !splitNumber) {
    return (
      <p className='text-sm text-muted-foreground'>
        Set the shift and split numbers on the first step.
      </p>
    )
  }

  if (isSingle) {
    return <SingleShiftFields disabled={disabled} />
  }

  return (
    <div className='space-y-4'>
      {shiftNumber > 1 && <ShiftRotationFields disabled={disabled} />}

      {shiftFields.map((field, index) => (
        <ShiftRow
          key={field.id}
          index={index}
          splitNumber={splitNumber}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

function ShiftRotationFields({ disabled }: { disabled?: boolean }) {
  const { control, getValues, setValue } = useFormContext<any>()
  const shiftCycle = useWatch({ control, name: 'shift_cycle' }) as
    | ShiftCycle
    | undefined
  const rotationOptions = shiftCycle ? getShiftRotationOptions(shiftCycle) : []

  useEffect(() => {
    if (getValues('repeated_shift') == null) {
      setValue('repeated_shift', 1)
    }
  }, [])

  return (
    <Card className='gap-3 py-4'>
      <CardContent className='grid gap-4 px-4 sm:grid-cols-3'>
        <FormField
          control={control}
          name='shift_cycle'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift cycle</FormLabel>
              <SelectDropdown
                isControlled
                defaultValue={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  const rotation = getValues('shift_rotation')
                  const validRotations = getShiftRotationOptions(
                    value as ShiftCycle
                  )
                  if (!validRotations.some((o) => o.value === rotation)) {
                    setValue('shift_rotation', undefined)
                  }
                }}
                placeholder='Select a cycle'
                items={SHIFT_CYCLE_OPTIONS}
                disabled={disabled}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name='shift_rotation'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift rotation</FormLabel>
              <SelectDropdown
                isControlled
                defaultValue={field.value}
                onValueChange={field.onChange}
                placeholder={
                  shiftCycle
                    ? 'Select a rotation'
                    : 'Select a shift cycle first'
                }
                items={rotationOptions}
                disabled={disabled || !shiftCycle}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name='repeated_shift'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repeated shift</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
                  max={3}
                  disabled={disabled}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}

function SingleShiftFields({ disabled }: { disabled?: boolean }) {
  const { control, getValues, setValue } = useFormContext<any>()
  const time = useWatch({ control, name: 'single_shift.time' })
  const hasBreak = useWatch({ control, name: 'single_shift.has_break' })
  const breakTime = useWatch({ control, name: 'single_shift.break_time' })
  const days = useWatch({ control, name: 'single_shift.days' }) as
    | DayOfWeek[]
    | undefined
  const { errors } = useFormState({ control, name: 'single_shift.days' })
  const daysError = (
    errors?.single_shift as { days?: { message?: string } } | undefined
  )?.days?.message

  const hours = calculateHours(time ? [time] : [])
  const breakDuration = calculateHours(breakTime ? [breakTime] : [])

  const toggleDay = (day: DayOfWeek, checked: boolean) => {
    const current = (getValues('single_shift.days') as
      | DayOfWeek[]
      | undefined) ?? []
    if (checked) {
      if (!current.includes(day)) {
        setValue('single_shift.days', [...current, day])
      }
    } else {
      setValue(
        'single_shift.days',
        current.filter((d) => d !== day)
      )
    }
  }

  return (
    <div className='space-y-4'>
      <FormItem>
        <FormLabel>Days</FormLabel>
        <div className='grid grid-cols-7 gap-1 text-center'>
          {DAYS_OF_WEEK.map((day) => {
            const checked = (days ?? []).includes(day)
            return (
              <button
                key={day}
                type='button'
                disabled={disabled}
                onClick={() => toggleDay(day, !checked)}
                className={cn(
                  'rounded-md border p-2 text-xs capitalize transition-colors',
                  checked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {day.slice(0, 3)}
              </button>
            )
          })}
        </div>
        {daysError && <p className='text-sm text-destructive'>{daysError}</p>}
      </FormItem>

      <FormItem>
        <FormLabel>Shift time</FormLabel>
        <div className='flex items-start gap-2'>
          <FormField
            control={control}
            name='single_shift.time.from_time'
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormControl>
                  <Input
                    type='time'
                    disabled={disabled}
                    max={time?.to_time || undefined}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <span className='pt-2 text-sm text-muted-foreground'>to</span>
          <FormField
            control={control}
            name='single_shift.time.to_time'
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormControl>
                  <Input
                    type='time'
                    disabled={disabled}
                    min={time?.from_time || undefined}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className='flex justify-end'>
          <Badge variant='secondary'>{hours}h total</Badge>
        </div>
      </FormItem>

      <FormField
        control={control}
        name='single_shift.has_break'
        render={({ field }) => (
          <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Include a break</FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  field.onChange(checked)
                  if (checked && !breakTime) {
                    setValue('single_shift.break_time', {
                      from_time: '12:00',
                      to_time: '13:00',
                    })
                    setValue('single_shift.break_hours', 1)
                  }
                }}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {hasBreak && (
        <FormItem>
          <FormLabel>Break time</FormLabel>
          <div className='flex items-start gap-2'>
            <FormField
              control={control}
              name='single_shift.break_time.from_time'
              render={({ field }) => (
                <FormItem className='flex-1'>
                  <FormControl>
                    <Input
                      type='time'
                      disabled={disabled}
                      min={time?.from_time || undefined}
                      max={breakTime?.to_time || undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <span className='pt-2 text-sm text-muted-foreground'>to</span>
            <FormField
              control={control}
              name='single_shift.break_time.to_time'
              render={({ field }) => (
                <FormItem className='flex-1'>
                  <FormControl>
                    <Input
                      type='time'
                      disabled={disabled}
                      min={breakTime?.from_time || undefined}
                      max={time?.to_time || undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className='flex justify-end'>
            <Badge variant='secondary'>{breakDuration}h total</Badge>
          </div>

          <FormField
            control={control}
            name='single_shift.break_hours'
            render={({ field }) => (
              <FormItem className='pt-2'>
                <FormLabel>Break hours</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0.25}
                    step={0.25}
                    max={breakDuration || undefined}
                    disabled={disabled}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormItem>
      )}
    </div>
  )
}

type ShiftRowProps = {
  index: number
  splitNumber: number
  disabled?: boolean
}

function ShiftRow({ index, splitNumber, disabled }: ShiftRowProps) {
  const { control, getValues, setValue } = useFormContext<any>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: `shifts.${index}.days`,
  })
  const hasBreak = useWatch({ control, name: `shifts.${index}.has_break` })
  const breakTime = useWatch({ control, name: `shifts.${index}.break_time` })
  const days = useWatch({ control, name: `shifts.${index}.days` }) as
    | RegularShiftDay[]
    | undefined
  const { errors } = useFormState({ control, name: `shifts.${index}.days` })
  const daysError = (
    errors?.shifts as
      | { [key: number]: { days?: { message?: string } } }
      | undefined
  )?.[index]?.days?.message

  const dayHours = (days ?? []).map((d) => calculateHours(d.splits))
  const maxBreakHours =
    dayHours.length > 0 ? Math.min(12, Math.min(...dayHours)) : 12
  const breakDuration = calculateHours(breakTime ? [breakTime] : [])

  const toggleDay = (day: DayOfWeek, checked: boolean) => {
    const dayIndex = fields.findIndex(
      (f) => (f as unknown as { day: string }).day === day
    )
    if (checked && dayIndex === -1) {
      append({ day, splits: makeSplits(splitNumber) })
    } else if (!checked && dayIndex > -1) {
      remove(dayIndex)
    }
  }

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='flex items-center gap-2 text-sm font-medium'>
          Shift {index + 1}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 px-4'>
        <div className='grid grid-cols-7 gap-1 text-center'>
          {DAYS_OF_WEEK.map((day) => {
            const checked = fields.some(
              (f) => (f as unknown as { day: string }).day === day
            )
            return (
              <button
                key={day}
                type='button'
                disabled={disabled}
                onClick={() => toggleDay(day, !checked)}
                className={cn(
                  'rounded-md border p-2 text-xs capitalize transition-colors',
                  checked
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {day.slice(0, 3)}
              </button>
            )
          })}
        </div>
        {daysError && (
          <p className='text-sm text-destructive'>{daysError}</p>
        )}

        {fields.map((dayField, dayIndex) => {
          const day = (dayField as unknown as { day: DayOfWeek }).day
          return (
            <div key={dayField.id} className='space-y-1'>
              <p className='text-xs font-medium text-muted-foreground capitalize'>
                {day} · {splitNumber} split{splitNumber > 1 ? 's' : ''}
              </p>
              <TimeRangeFields
                control={control}
                name={`shifts.${index}.days.${dayIndex}.splits`}
                disabled={disabled}
                fixedCount
              />
            </div>
          )
        })}

        <FormField
          control={control}
          name={`shifts.${index}.has_break`}
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
              <FormLabel className='cursor-pointer'>Include a break</FormLabel>
              <FormControl>
                <Switch
                  checked={!!field.value}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    if (checked) {
                      if (getValues(`shifts.${index}.break_time`) == null) {
                        setValue(`shifts.${index}.break_time`, {
                          from_time: '12:00',
                          to_time: '13:00',
                        })
                      }
                      if (getValues(`shifts.${index}.break_hours`) == null) {
                        setValue(`shifts.${index}.break_hours`, 1)
                      }
                    }
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {hasBreak && (
          <FormItem>
            <FormLabel>Break time</FormLabel>
            <div className='flex items-start gap-2'>
              <FormField
                control={control}
                name={`shifts.${index}.break_time.from_time`}
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormControl>
                      <Input
                        type='time'
                        disabled={disabled}
                        max={breakTime?.to_time || undefined}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <span className='pt-2 text-sm text-muted-foreground'>to</span>
              <FormField
                control={control}
                name={`shifts.${index}.break_time.to_time`}
                render={({ field }) => (
                  <FormItem className='flex-1'>
                    <FormControl>
                      <Input
                        type='time'
                        disabled={disabled}
                        min={breakTime?.from_time || undefined}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className='flex justify-end'>
              <Badge variant='secondary'>{breakDuration}h total</Badge>
            </div>

            <FormField
              control={control}
              name={`shifts.${index}.break_hours`}
              render={({ field }) => (
                <FormItem className='pt-2'>
                  <FormLabel>Break hours</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={Math.min(maxBreakHours, breakDuration || maxBreakHours)}
                      disabled={disabled}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormItem>
        )}
      </CardContent>
    </Card>
  )
}
