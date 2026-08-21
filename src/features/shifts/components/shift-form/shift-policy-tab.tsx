import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PolicyPicker } from '@/features/shift-policies/components/policy-picker'
import { type ShiftFormValues } from '../../data/schema'

// "Shift policy" tab — attaches any number of shared shift-policy records
// (see `features/shift-policies`) to this shift, and creates new ones
// inline. The picker itself is shared with the shifts table's "Modify
// policy" drawer; this tab is just its react-hook-form host.
export function ShiftPolicyTab() {
  const form = useFormContext<ShiftFormValues>()

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='policy_ids'
        render={({ field }) => (
          <FormItem className='space-y-3'>
            <FormLabel className='text-base font-semibold'>
              Shift policies
            </FormLabel>
            <FormControl>
              <PolicyPicker value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
