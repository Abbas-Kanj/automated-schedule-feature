import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { RECURRENCE_END_TYPE_OPTIONS } from '../../data/data'
import { DateField } from './date-field'

type RecurrenceEndFieldsProps = {
  disabled?: boolean
}

export function RecurrenceEndFields({ disabled }: RecurrenceEndFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const endType = useWatch({ control, name: 'recurrence.end_type' }) as
    | string
    | undefined

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='recurrence.end_type'
        render={({ field }) => (
          <FormItem className='space-y-2'>
            <FormLabel>End settings</FormLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              className='gap-2'
            >
              {RECURRENCE_END_TYPE_OPTIONS.map((o) => (
                <FormItem
                  key={o.value}
                  className='flex items-center gap-2 space-y-0'
                >
                  <FormControl>
                    <RadioGroupItem value={o.value} />
                  </FormControl>
                  <FormLabel className='cursor-pointer font-normal'>
                    {o.label}
                  </FormLabel>
                </FormItem>
              ))}
            </RadioGroup>
            <FormMessage />
          </FormItem>
        )}
      />

      {endType === 'after_occurrences' && (
        <FormField
          control={control}
          name='recurrence.end_occurrences'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Occurrences</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
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

      {endType === 'on_date' && (
        <FormField
          control={control}
          name='recurrence.end_date'
          render={({ field }) => (
            <FormItem>
              <FormLabel>End date</FormLabel>
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
      )}

      <div className='space-y-2 border-t pt-3'>
        <FormLabel>Exception settings</FormLabel>
        <FormField
          control={control}
          name='recurrence.exceptions.public_holiday'
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
              <FormLabel className='cursor-pointer font-normal'>
                Public holiday
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
        <FormField
          control={control}
          name='recurrence.exceptions.sick_leave'
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
              <FormLabel className='cursor-pointer font-normal'>
                Sick leave
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
      </div>
    </div>
  )
}
