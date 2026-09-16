import { useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { OCCURRENCE_FREQUENCY_OPTIONS } from '../../data/data'
import { DEFAULT_OCCURRENCE } from '../../data/schema'
import { PerShiftRecurrenceFields } from './per-shift-recurrence-fields'

type OccurrenceFieldsProps = {
  disabled?: boolean
}

const EXCEPTIONS = [
  { name: 'occurrence_exceptions.public_holiday', label: 'Public holiday' },
  { name: 'occurrence_exceptions.sick_leave', label: 'Sick leave' },
] as const

// Fixed only — the counterpart of rotate's "Custom alternate" pattern: each
// selected shift repeats on its own rule. End settings live in "Start & End",
// so they aren't repeated here.
export function OccurrenceFields({ disabled }: OccurrenceFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const shiftIds =
    (useWatch({ control, name: 'shift_ids' }) as string[] | undefined) ?? []

  return (
    <div className='space-y-4'>
      {shiftIds.length === 0 ? (
        <p className='text-sm text-muted-foreground'>
          Pick shifts in the previous step to set how often each occurs.
        </p>
      ) : (
        <PerShiftRecurrenceFields
          name='shift_occurrences'
          title='Frequency'
          shiftIds={shiftIds}
          frequencyOptions={OCCURRENCE_FREQUENCY_OPTIONS}
          defaultRule={DEFAULT_OCCURRENCE}
          disabled={disabled}
        />
      )}

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
