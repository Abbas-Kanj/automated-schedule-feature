import { useFormContext } from 'react-hook-form'
import {
  RecurrenceFrequencyFields as SharedRecurrenceFrequencyFields,
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
import { RECURRENCE_FREQUENCY_OPTIONS } from '../../data/data'
import { DAYS_OF_WEEK } from '../../data/schema'

type RecurrenceFrequencyFieldsProps = {
  disabled?: boolean
}

// Chip labels (e.g. "Mon") derived from the full day names DAYS_OF_WEEK
// uses ('monday', ...) — shared with `shifts` via
// `@/components/recurrence-frequency-fields`.
const WEEKDAY_OPTIONS: RecurrenceOption[] = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: day.charAt(0).toUpperCase() + day.slice(1, 3),
}))

export function RecurrenceFrequencyFields({
  disabled,
}: RecurrenceFrequencyFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()

  return (
    <SharedRecurrenceFrequencyFields
      control={control}
      name='recurrence'
      frequencyOptions={RECURRENCE_FREQUENCY_OPTIONS}
      weekdayOptions={WEEKDAY_OPTIONS}
      disabled={disabled}
      monthlyFields={
        <div className='space-y-3'>
          <FormField
            control={control}
            name='recurrence.interval'
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
                  <span className='text-muted-foreground text-sm'>
                    month(s)
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={control}
              name='recurrence.day_of_month_from'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of month (from)</FormLabel>
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
            <FormField
              control={control}
              name='recurrence.day_of_month_to'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of month (to)</FormLabel>
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
        </div>
      }
    />
  )
}
