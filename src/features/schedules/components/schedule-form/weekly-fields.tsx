import { format, getDay } from 'date-fns'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/select-dropdown'
import { MONTHS } from '../../data/data'
import { type DayOfWeek } from '../../data/schema'
import { getDaysOfMonth } from '../../utils'
import { TimeRangeFields } from './time-range-fields'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type WeeklyFieldsProps = {
  disabled?: boolean
}

export function WeeklyFields({ disabled }: WeeklyFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const year = useWatch({ control, name: 'year' })
  const month = useWatch({ control, name: 'month' })
  const week = useWatch({ control, name: 'week' })

  const { fields, append, remove } = useFieldArray({ control, name: 'days' })

  const monthDays = year && month ? getDaysOfMonth(year, month) : []
  const leadingBlanks = monthDays.length > 0 ? getDay(monthDays[0].date) : 0

  const startIndex = monthDays.findIndex((d) => d.date_str === week?.start_date)
  const endIndex = monthDays.findIndex((d) => d.date_str === week?.end_date)
  const selectedRangeDays =
    startIndex > -1 && endIndex > -1 && endIndex >= startIndex
      ? monthDays.slice(startIndex, endIndex + 1)
      : []
  const maxLength =
    startIndex > -1 ? Math.min(7, monthDays.length - startIndex) : 7

  const handleSelectStart = (dateStr: string) => {
    const idx = monthDays.findIndex((d) => d.date_str === dateStr)
    if (idx === -1) return
    const desiredLength = selectedRangeDays.length || 7
    const clampedLength = Math.min(desiredLength, 7, monthDays.length - idx)
    setValue('week', {
      start_date: dateStr,
      end_date: monthDays[idx + clampedLength - 1].date_str,
    })
    setValue('days', [])
  }

  const handleSelectLength = (length: number) => {
    if (startIndex === -1) return
    const clampedLength = Math.min(length, 7, monthDays.length - startIndex)
    const newRangeDays = monthDays.slice(startIndex, startIndex + clampedLength)
    setValue('week.end_date', newRangeDays[newRangeDays.length - 1].date_str)

    const rangeWeekdays = new Set<string>(newRangeDays.map((d) => d.weekday))
    const removeIndices = fields
      .map((f, i) => ({ day: (f as unknown as { day: string }).day, i }))
      .filter(({ day }) => !rangeWeekdays.has(day))
      .map(({ i }) => i)
    if (removeIndices.length) remove(removeIndices)
  }

  const toggleDay = (day: DayOfWeek, checked: boolean) => {
    const index = fields.findIndex(
      (f) => (f as unknown as { day: string }).day === day
    )
    if (checked && index === -1) {
      append({ day, times: [{ from_time: '09:00', to_time: '17:00' }] })
    } else if (!checked && index > -1) {
      remove(index)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={control}
          name='year'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  disabled={disabled}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name='month'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Month</FormLabel>
              <SelectDropdown
                defaultValue={field.value ? String(field.value) : undefined}
                onValueChange={(value) => {
                  field.onChange(Number(value))
                  setValue('week', { start_date: '', end_date: '' })
                  setValue('days', [])
                }}
                placeholder='Select a month'
                items={MONTHS}
                disabled={disabled}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {monthDays.length > 0 && (
        <FormItem>
          <FormLabel>Pick a starting day</FormLabel>
          <div className='grid grid-cols-7 gap-1 text-center'>
            {WEEKDAY_HEADERS.map((h) => (
              <div key={h} className='text-muted-foreground text-xs'>
                {h}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {monthDays.map((d) => {
              const isStart = d.date_str === week?.start_date
              const inRange = selectedRangeDays.some(
                (r) => r.date_str === d.date_str
              )
              return (
                <button
                  key={d.date_str}
                  type='button'
                  disabled={disabled}
                  onClick={() => handleSelectStart(d.date_str)}
                  className={cn(
                    'rounded-md border p-2 text-sm transition-colors',
                    inRange
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent',
                    isStart && 'ring-primary ring-2 ring-offset-1',
                    disabled && 'cursor-not-allowed'
                  )}
                >
                  {format(d.date, 'd')}
                </button>
              )
            })}
          </div>
          <FormMessage />
        </FormItem>
      )}

      {startIndex > -1 && (
        <FormItem>
          <FormLabel>
            Number of consecutive days (max 7)
            {selectedRangeDays.length > 0 && (
              <span className='text-muted-foreground ml-2 font-normal'>
                {format(selectedRangeDays[0].date, 'MMM d')} –{' '}
                {format(
                  selectedRangeDays[selectedRangeDays.length - 1].date,
                  'MMM d'
                )}
              </span>
            )}
          </FormLabel>
          <div className='flex gap-2'>
            {Array.from({ length: 7 }, (_, i) => i + 1).map((length) => (
              <button
                key={length}
                type='button'
                disabled={disabled || length > maxLength}
                onClick={() => handleSelectLength(length)}
                className={cn(
                  'h-8 w-8 rounded-md border text-sm transition-colors',
                  length === selectedRangeDays.length
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent disabled:hover:bg-transparent',
                  length > maxLength && 'cursor-not-allowed opacity-40'
                )}
              >
                {length}
              </button>
            ))}
          </div>
        </FormItem>
      )}

      {selectedRangeDays.length > 0 && (
        <FormField
          control={control}
          name='days'
          render={({ fieldState }) => (
            <FormItem>
              <FormLabel>Days</FormLabel>
              <div className='grid gap-3 sm:grid-cols-2'>
                {selectedRangeDays.map((d) => {
                  const index = fields.findIndex(
                    (f) => (f as unknown as { day: string }).day === d.weekday
                  )
                  const checked = index > -1

                  return (
                    <Card
                      key={d.date_str}
                      className={
                        checked ? 'gap-3 py-3' : 'gap-3 py-3 opacity-70'
                      }
                    >
                      <CardHeader className='px-3'>
                        <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(value) =>
                              toggleDay(d.weekday, !!value)
                            }
                          />
                          {d.weekday.charAt(0).toUpperCase() +
                            d.weekday.slice(1)}
                          <span className='text-muted-foreground text-xs font-normal'>
                            {format(d.date, 'MMM d')}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      {checked && (
                        <CardContent className='px-3'>
                          <TimeRangeFields
                            control={control}
                            name={`days.${index}.times`}
                            disabled={disabled}
                          />
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
              {fieldState.error && (
                <p className='text-destructive text-sm'>
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />
      )}
    </div>
  )
}
