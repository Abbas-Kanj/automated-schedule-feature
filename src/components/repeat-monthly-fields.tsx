import { useEffect } from 'react'
import { type Control, useFieldArray, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RecurrenceWeekdayChips, type RecurrenceOption } from './recurrence-frequency-fields'

// Monday by default, like the "Case Monthly" wireframe's example ("the 2nd
// Monday").
const DEFAULT_DAY_POSITION_RULE = { position: 2, weekday: 'mon' } as const

type RepeatMonthlyFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  // Field path prefix — reads/writes `${name}.monthly_mode`,
  // `${name}.day_of_month`, `${name}.date_specific_1/2` and
  // `${name}.day_position_rules`. Lets `shifts`' Repeat tab and `schedules`'
  // rotate "Custom alternate" per-shift repeat rows share this component
  // despite their different field names — same pattern as
  // `RecurrenceFrequencyFields`.
  name: string
  monthlyModeOptions: RecurrenceOption[]
  weekdayOptions: RecurrenceOption[]
  disabled?: boolean
}

// Shared "Repeat monthly" sub-mode block — a single day-of-month, two
// specific day-of-month picks, or an "nth weekday of the month" pattern
// (e.g. "the 2nd Tuesday"). Extracted from shifts' own `RepeatFields` (see
// `shift-form/repeat-fields.tsx`) so schedules' rotate "Custom alternate"
// pattern type (see `schedule-form/pattern-builder.tsx`'s `ShiftRepeats`)
// can reuse the exact same UI/logic — everything shifts' "Repeat" tab
// renders once `frequency === 'monthly'` except its end-frequency section,
// which that consumer renders separately (or not at all).
export function RepeatMonthlyFields({
  control,
  name,
  monthlyModeOptions,
  weekdayOptions,
  disabled,
}: RepeatMonthlyFieldsProps) {
  const monthlyMode = useWatch({ control, name: `${name}.monthly_mode` }) as
    | string
    | undefined

  const { fields: dayPositionRules, append: appendDayPositionRule } =
    useFieldArray({ control, name: `${name}.day_position_rules` })

  // Day-position mode allows exactly one rule — seed it the moment this
  // sub-mode becomes active instead of requiring an "Add rule" click.
  useEffect(() => {
    if (monthlyMode === 'day_position' && dayPositionRules.length === 0) {
      appendDayPositionRule({ ...DEFAULT_DAY_POSITION_RULE })
    }
  }, [monthlyMode, dayPositionRules.length, appendDayPositionRule])

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <FormField
        control={control}
        name={`${name}.monthly_mode`}
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
                {monthlyModeOptions.map((option) => (
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
          name={`${name}.day_of_month`}
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
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
            name={`${name}.date_specific_1`}
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
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <span className='text-muted-foreground pb-2 text-sm'>and</span>
          <FormField
            control={control}
            name={`${name}.date_specific_2`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={28}
                    disabled={disabled}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
              name={`${name}.day_position_rules.${index}.position`}
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
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.day_position_rules.${index}.weekday`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repeat on which day</FormLabel>
                  <RecurrenceWeekdayChips
                    options={weekdayOptions}
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
          name={`${name}.day_position_rules`}
          render={() => <FormMessage />}
        />
      )}
    </div>
  )
}
