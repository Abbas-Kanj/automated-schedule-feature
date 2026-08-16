import { useFormContext, useWatch } from 'react-hook-form'
import { MultiSelect } from '@/components/multi-select'
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
import { Switch } from '@/components/ui/switch'
import {
  SERVICE_RESOURCE_OPTIONS,
  SERVICE_TERRITORY_OPTIONS,
  WORK_TYPE_GROUP_OPTIONS,
} from '../../data/data'
import { type ShiftFormValues } from '../../data/schema'

// "Assign to" tab of `ShiftFormDialog` (formerly "Additional info") — its
// own toggle enables/disables the picks below, which have no downstream
// validation of their own either way (see `schema.ts`).
export function AssignToTab() {
  const form = useFormContext<ShiftFormValues>()
  const assignToEnabled = useWatch({
    control: form.control,
    name: 'assign_to_enabled',
  })

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='assign_to_enabled'
        render={({ field }) => (
          <FormItem className='flex w-fit flex-row items-center gap-4 rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Assign to</FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='work_type_group'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Work type group</FormLabel>
            <MultiSelect
              options={WORK_TYPE_GROUP_OPTIONS}
              value={WORK_TYPE_GROUP_OPTIONS.filter((option) =>
                field.value?.includes(option.value)
              )}
              onChange={(selected: typeof WORK_TYPE_GROUP_OPTIONS) =>
                field.onChange(selected.map((option) => option.value))
              }
              isMulti
              placeholder='Select work type groups'
              isDisabled={!assignToEnabled}
            />
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
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!assignToEnabled}
            >
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
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!assignToEnabled}
            >
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
