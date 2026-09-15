import { useFormContext } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { RecurrenceFrequencyFields } from '@/components/recurrence-frequency-fields'
import { RepeatMonthlyFields } from '@/components/repeat-monthly-fields'
import {
  OCCURRENCE_FREQUENCY_OPTIONS,
  SHIFT_REPEAT_MONTHLY_MODE_OPTIONS,
  SHIFT_REPEAT_WEEKDAY_OPTIONS,
} from '../../data/data'

type OccurrenceFieldsProps = {
  disabled?: boolean
}

const EXCEPTIONS = [
  { name: 'occurrence.exceptions.public_holiday', label: 'Public holiday' },
  { name: 'occurrence.exceptions.sick_leave', label: 'Sick leave' },
] as const

// Fixed only — the counterpart of rotate's Pattern step. End settings live in
// "Start & End", so they aren't repeated here.
export function OccurrenceFields({ disabled }: OccurrenceFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()

  return (
    <div className='space-y-4'>
      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-sm font-medium'>Frequency</CardTitle>
        </CardHeader>
        <CardContent className='px-4'>
          <RecurrenceFrequencyFields
            control={control}
            name='occurrence'
            frequencyOptions={OCCURRENCE_FREQUENCY_OPTIONS}
            weekdayOptions={SHIFT_REPEAT_WEEKDAY_OPTIONS}
            disabled={disabled}
            monthlyFields={
              <RepeatMonthlyFields
                control={control}
                name='occurrence'
                monthlyModeOptions={SHIFT_REPEAT_MONTHLY_MODE_OPTIONS}
                weekdayOptions={SHIFT_REPEAT_WEEKDAY_OPTIONS}
                disabled={disabled}
              />
            }
          />
        </CardContent>
      </Card>

      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-sm font-medium'>Exception</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 px-4'>
          {EXCEPTIONS.map((exception) => (
            <FormField
              key={exception.name}
              control={control}
              name={exception.name}
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
                  <FormLabel className='cursor-pointer font-normal'>
                    {exception.label}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={!!field.value}
                      disabled={disabled}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
