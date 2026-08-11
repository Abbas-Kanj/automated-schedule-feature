import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/select-dropdown'
import { RECURRENCE_FREQUENCY_OPTIONS } from '../../data/data'
import { WeekdayChips } from './weekday-chips'

type RecurrenceFrequencyFieldsProps = {
  disabled?: boolean
}

export function RecurrenceFrequencyFields({
  disabled,
}: RecurrenceFrequencyFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const frequency = useWatch({ control, name: 'recurrence.frequency' }) as
    | string
    | undefined

  return (
    <div className='space-y-3'>
      <FormField
        control={control}
        name='recurrence.frequency'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Repeat frequency</FormLabel>
            <SelectDropdown
              isControlled
              defaultValue={field.value}
              onValueChange={field.onChange}
              placeholder='Select a frequency'
              items={RECURRENCE_FREQUENCY_OPTIONS}
              disabled={disabled}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='recurrence.interval'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Repeat every</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <p className='text-xs text-muted-foreground'>
              {frequency === 'daily' && 'day(s)'}
              {frequency === 'weekly' && 'week(s)'}
              {frequency === 'monthly' && 'month(s)'}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      {(frequency === 'daily' || frequency === 'weekly') && (
        <FormItem>
          <FormLabel>Repeat on</FormLabel>
          <WeekdayChips
            control={control}
            name='recurrence.weekdays'
            disabled={disabled}
          />
        </FormItem>
      )}

      {frequency === 'monthly' && (
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
      )}
    </div>
  )
}
