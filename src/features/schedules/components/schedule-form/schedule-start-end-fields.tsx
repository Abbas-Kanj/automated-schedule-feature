import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { DateField } from '@/components/date-field'
import { EndFrequencyFields } from '@/components/end-frequency-fields'
import { type Schedule } from '../../data/schema'

type ScheduleStartEndFieldsProps = {
  disabled?: boolean
}

// Shared "Start & End" step body: start date + end frequency (`end_settings`).
export function ScheduleStartEndFields({
  disabled,
}: ScheduleStartEndFieldsProps) {
  const { control } = useFormContext<Schedule>()

  return (
    <div className='space-y-6'>
      <FormField
        control={control}
        name='start_date'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Start date</FormLabel>
            <FormControl>
              <DateField
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <EndFrequencyFields
        control={control}
        name='end_settings'
        disabled={disabled}
      />
    </div>
  )
}
