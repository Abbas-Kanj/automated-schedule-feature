import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'

type RecurrenceExceptionFieldsProps = {
  disabled?: boolean
}

export function RecurrenceExceptionFields({
  disabled,
}: RecurrenceExceptionFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()

  return (
    <div className='space-y-2'>
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
  )
}
