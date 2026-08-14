import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  SERVICE_RESOURCE_OPTIONS,
  SERVICE_TERRITORY_OPTIONS,
  WORK_TYPE_GROUP_OPTIONS,
} from '../../data/data'
import { type ShiftFormValues } from '../../data/schema'

// "Additional info" tab of `ShiftFormDialog` — freeform picks with no
// downstream validation of their own (see `schema.ts`).
export function AdditionalInfoTab() {
  const form = useFormContext<ShiftFormValues>()

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='work_type_group'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Work type group</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a work type group' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {WORK_TYPE_GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='service_resource'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Service resource</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a service resource' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {SERVICE_RESOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='service_territory'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Service territory</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a service territory' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {SERVICE_TERRITORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
