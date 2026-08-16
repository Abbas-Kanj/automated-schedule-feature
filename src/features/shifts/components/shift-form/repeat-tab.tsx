import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { type ShiftFormValues } from '../../data/schema'
import { RepeatFields } from './repeat-fields'

// "Repeat" tab of `ShiftFormDialog` — the "Repeat" toggle plus the shared
// `RepeatFields` (frequency/interval/weekdays/monthly/end).
export function RepeatTab() {
  const form = useFormContext<ShiftFormValues>()
  const repeatEnabled = useWatch({
    control: form.control,
    name: 'repeat_enabled',
  })

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='repeat_enabled'
        render={({ field }) => (
          <FormItem className='flex w-fit flex-row items-center gap-4 rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Repeat</FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <RepeatFields disabled={!repeatEnabled} />
    </div>
  )
}
