import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import {
  RecurrenceFrequencyFields,
  type RecurrenceOption,
} from '@/components/recurrence-frequency-fields'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DAY_LABELS,
  REPEAT_FREQUENCY_OPTIONS,
  REPEAT_MONTHLY_MODE_OPTIONS,
} from '../../data/data'
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type RepeatFrequency,
  type RepeatMonthlyMode,
} from '../../data/schema'
import { DateField } from './date-field'

type RepeatFieldsProps = {
  disabled?: boolean
}

const DEFAULT_DAY_POSITION_RULE = { position: 2, weekday: 'tue' } as const

// The frequency picker's weekday chips — shared with `schedules`' own
// recurrence fields via `RecurrenceFrequencyFields` (see
// `@/components/recurrence-frequency-fields`).
const WEEKDAY_OPTIONS: RecurrenceOption[] = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: DAY_LABELS[day],
}))

export function RepeatFields({ disabled }: RepeatFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const frequency = useWatch({ control, name: 'repeat.frequency' }) as
    | RepeatFrequency
    | undefined
  const monthlyMode = useWatch({ control, name: 'repeat.monthly_mode' }) as
    | RepeatMonthlyMode
    | undefined
  const endType = useWatch({ control, name: 'repeat.end_type' }) as
    | string
    | undefined
  const weekdays = useWatch({ control, name: 'repeat.weekdays' }) as
    | DayOfWeek[]
    | undefined

  const { fields: dayPositionRules, append: appendDayPositionRule } =
    useFieldArray({ control, name: 'repeat.day_position_rules' })

  // Day-position mode allows exactly one rule — seed it the moment this
  // sub-mode becomes active instead of requiring an "Add rule" click.
  useEffect(() => {
    if (monthlyMode === 'day_position' && dayPositionRules.length === 0) {
      appendDayPositionRule({ ...DEFAULT_DAY_POSITION_RULE })
    }
  }, [monthlyMode, dayPositionRules.length, appendDayPositionRule])

  // Weekly frequency only allows one day — if a multi-day selection was
  // made while on daily and the user switches to weekly, trim it down to
  // just the first day instead of leaving several chips looking selected.
  useEffect(() => {
    if (frequency === 'weekly' && weekdays && weekdays.length > 1) {
      setValue('repeat.weekdays', [weekdays[0]])
    }
  }, [frequency, weekdays, setValue])

  // Monthly's 3 sub-modes each carry their own "Repeat every ... month(s)"
  // (see the "Case Monthly" wireframe) rather than sharing the generic one
  // above — same underlying `repeat.interval` field, just rendered inside
  // whichever case box is active.
  const monthlyIntervalField = (
    <FormField
      control={control}
      name='repeat.interval'
      render={({ field }) => (
        <FormItem>
          <FormLabel>Repeat every</FormLabel>
          <div className='flex items-center gap-2'>
            <FormControl>
              <Input
                type='number'
                min={1}
                className='w-24'
                disabled={disabled}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <span className='text-muted-foreground text-sm'>month(s)</span>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <div className='space-y-4'>
      <RecurrenceFrequencyFields
        control={control}
        name='repeat'
        frequencyOptions={REPEAT_FREQUENCY_OPTIONS}
        weekdayOptions={WEEKDAY_OPTIONS}
        weeklySingleDay
        disabled={disabled}
        monthlyFields={
          <div className='space-y-3 rounded-md border p-3'>
            <FormField
              control={control}
              name='repeat.monthly_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date / Day</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select how it repeats' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REPEAT_MONTHLY_MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {monthlyMode === 'day_month' && (
              <div className='space-y-3'>
                {monthlyIntervalField}
                <FormField
                  control={control}
                  name='repeat.day_of_month'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day of the month</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={28}
                          disabled={disabled}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {monthlyMode === 'date_specific' && (
              <div className='space-y-3'>
                {monthlyIntervalField}
                <div className='flex items-end gap-2'>
                  <FormField
                    control={control}
                    name='repeat.date_specific_1'
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <FormLabel>Date specific</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={1}
                            max={28}
                            disabled={disabled}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <span className='text-muted-foreground pb-2 text-sm'>
                    and
                  </span>
                  <FormField
                    control={control}
                    name='repeat.date_specific_2'
                    render={({ field }) => (
                      <FormItem className='flex-1'>
                        <FormControl>
                          <Input
                            type='number'
                            min={1}
                            max={28}
                            disabled={disabled}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {monthlyMode === 'day_position' && (
              <div className='space-y-2'>
                {monthlyIntervalField}
                <FormLabel>Repeat on what day</FormLabel>
                {dayPositionRules.map((rule, index) => (
                  <div key={rule.id} className='flex items-center gap-2'>
                    <FormField
                      control={control}
                      name={`repeat.day_position_rules.${index}.position`}
                      render={({ field }) => (
                        <Input
                          type='number'
                          min={1}
                          max={28}
                          className='flex-1'
                          placeholder='Day #'
                          disabled={disabled}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      )}
                    />
                    <FormField
                      control={control}
                      name={`repeat.day_position_rules.${index}.weekday`}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={disabled}
                        >
                          <SelectTrigger className='flex-1'>
                            <SelectValue placeholder='Day' />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day} value={day}>
                                {DAY_LABELS[day]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                ))}
                <FormField
                  control={control}
                  name='repeat.day_position_rules'
                  render={() => <FormMessage />}
                />
              </div>
            )}
          </div>
        }
      />

      <FormField
        control={control}
        name='repeat.end_type'
        render={({ field }) => (
          <FormItem className='space-y-2'>
            <FormLabel>End settings</FormLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              className='gap-2'
            >
              <FormItem className='flex items-center gap-2 space-y-0'>
                <FormControl>
                  <RadioGroupItem value='never' />
                </FormControl>
                <FormLabel className='cursor-pointer font-normal'>
                  Never ends
                </FormLabel>
              </FormItem>

              <FormItem className='flex flex-wrap items-center gap-2 space-y-0'>
                <FormControl>
                  <RadioGroupItem value='after_occurrences' />
                </FormControl>
                <FormLabel className='cursor-pointer font-normal'>
                  End after
                </FormLabel>
                {endType === 'after_occurrences' && (
                  <FormField
                    control={control}
                    name='repeat.end_occurrences'
                    render={({ field: occurrencesField }) => (
                      <FormItem className='space-y-0'>
                        <FormControl>
                          <Input
                            type='number'
                            min={1}
                            className='h-8 w-24'
                            disabled={disabled}
                            value={occurrencesField.value ?? ''}
                            onChange={(e) =>
                              occurrencesField.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormItem>

              <FormItem className='flex flex-wrap items-center gap-2 space-y-0'>
                <FormControl>
                  <RadioGroupItem value='on_date' />
                </FormControl>
                <FormLabel className='cursor-pointer font-normal'>
                  End on
                </FormLabel>
                {endType === 'on_date' && (
                  <FormField
                    control={control}
                    name='repeat.end_date'
                    render={({ field: dateField }) => (
                      <FormItem className='space-y-0'>
                        <FormControl>
                          <DateField
                            value={dateField.value}
                            onChange={dateField.onChange}
                            disabled={disabled}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormItem>
            </RadioGroup>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
