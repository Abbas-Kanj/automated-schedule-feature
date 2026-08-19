import { useFormContext } from 'react-hook-form'
import { EndFrequencyFields } from '@/components/end-frequency-fields'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { DateField } from './date-field'

type ScheduleStartEndFieldsProps = {
  disabled?: boolean
}

// Shared "Start & End" step body — start date + end frequency block
// (`end_settings`). Used by fixed/flexible and rotate alike; rotate's own
// schema carries `end_settings` too so both arms share this exact step.
export function ScheduleStartEndFields({
  disabled,
}: ScheduleStartEndFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()

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
        DateField={DateField}
      />
    </div>
  )
}
