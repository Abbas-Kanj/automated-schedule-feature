import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { type RegularType } from '../../data/schema'
import { BadgeColorField } from './badge-color-field'
import { DateField } from './date-field'
import { IconPickerField } from './icon-picker-field'
import { PolicyPillField } from './policy-pill-field'
import { ScheduleTypeSelector } from './schedule-type-selector'

type RegularBasicsFieldsProps = {
  disabled?: boolean
  onTypeChange: (value: RegularType) => void
}

export function RegularBasicsFields({
  disabled,
  onTypeChange,
}: RegularBasicsFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='type'
        render={({ field }) => (
          <ScheduleTypeSelector
            value={field.value}
            onChange={onTypeChange}
            disabled={disabled}
          />
        )}
      />

      <FormField
        control={control}
        name='badge_color'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Badge color</FormLabel>
            <FormControl>
              <BadgeColorField
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='icon'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Icon</FormLabel>
            <FormControl>
              <IconPickerField
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='is_active'
        render={({ field }) => (
          <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Active status</FormLabel>
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
        name='policy_type'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Policy type</FormLabel>
            <FormControl>
              <PolicyPillField
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
    </div>
  )
}
