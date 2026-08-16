import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { type ShiftFormValues } from '../../data/schema'
import { PolicySelectField } from './policy-select-field'

// "Shift policy" tab of `ShiftFormDialog` — the optional policy pill/sheet
// picker, split out of `GeneralTab` into its own tab.
export function ShiftPolicyTab() {
  const form = useFormContext<ShiftFormValues>()
  const policyType = useWatch({ control: form.control, name: 'policy_type' })

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='policy_type'
        render={() => (
          <FormItem>
            <FormLabel>Shift policy</FormLabel>
            <FormControl>
              <PolicySelectField
                value={policyType}
                onChange={(value) =>
                  form.setValue('policy_type', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
