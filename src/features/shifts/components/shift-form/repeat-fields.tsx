import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import {
  RecurrenceFrequencyFields,
  RecurrenceWeekdayChips,
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
import { DAYS_OF_WEEK, type RepeatMonthlyMode } from '../../data/schema'
import { DateField } from './date-field'

type RepeatFieldsProps = {
  disabled?: boolean
}

// Monday by default, like the "Case Monthly" wireframe's example ("the 2nd
// Monday").
const DEFAULT_DAY_POSITION_RULE = { position: 2, weekday: 'mon' } as const

// The frequency picker's weekday chips — shared with `schedules`' own
// recurrence fields via `RecurrenceFrequencyFields` (see
// `@/components/recurrence-frequency-fields`).
const WEEKDAY_OPTIONS: RecurrenceOption[] = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: DAY_LABELS[day],
}))

export function RepeatFields({ disabled }: RepeatFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const monthlyMode = useWatch({ control, name: 'repeat.monthly_mode' }) as
    | RepeatMonthlyMode
    | undefined
  const endType = useWatch({ control, name: 'repeat.end_type' }) as
    | string
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

  return (
    <div className='space-y-4'>
      <RecurrenceFrequencyFields
        control={control}
        name='repeat'
        frequencyOptions={REPEAT_FREQUENCY_OPTIONS}
        weekdayOptions={WEEKDAY_OPTIONS}
        disabled={disabled}
        monthlyFields={
          <div className='space-y-3 rounded-md border p-3'>
            <FormField
              control={control}
              name='repeat.monthly_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repeat</FormLabel>
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
            )}

            {monthlyMode === 'date_specific' && (
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
            )}

            {monthlyMode === 'day_position' &&
              dayPositionRules.map((rule, index) => (
                <div key={rule.id} className='space-y-3'>
                  <FormField
                    control={control}
                    name={`repeat.day_position_rules.${index}.position`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day #</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={1}
                            max={28}
                            className='w-24'
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
                  <FormField
                    control={control}
                    name={`repeat.day_position_rules.${index}.weekday`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repeat on which day</FormLabel>
                        <RecurrenceWeekdayChips
                          options={WEEKDAY_OPTIONS}
                          value={field.value ? [field.value] : []}
                          onChange={(days) => field.onChange(days[0])}
                          disabled={disabled}
                          single
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            {monthlyMode === 'day_position' && (
              <FormField
                control={control}
                name='repeat.day_position_rules'
                render={() => <FormMessage />}
              />
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
                        <div className='flex items-center gap-2'>
                          <FormControl>
                            <Input
                              type='number'
                              min={1}
                              className='h-8 w-24'
                              disabled={disabled}
                              value={occurrencesField.value ?? ''}
                              onChange={(e) =>
                                occurrencesField.onChange(
                                  e.target.valueAsNumber
                                )
                              }
                            />
                          </FormControl>
                          <span className='text-muted-foreground text-sm'>
                            occurrence(s)
                          </span>
                        </div>
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
