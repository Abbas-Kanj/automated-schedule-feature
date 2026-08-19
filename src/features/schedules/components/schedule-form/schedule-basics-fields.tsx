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
import { type RegularType } from '../../data/schema'
import { ScheduleTypeSelector } from './schedule-type-selector'

type ScheduleBasicsFieldsProps = {
  disabled?: boolean
  onTypeChange: (value: RegularType) => void
}

export function ScheduleBasicsFields({
  disabled,
  onTypeChange,
}: ScheduleBasicsFieldsProps) {
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
        name='template_id'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Template</FormLabel>
            <FormControl>
              <Select
                value={field.value ?? 'blank'}
                onValueChange={field.onChange}
                disabled={disabled}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a template' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='blank'>Custom template</SelectItem>
                  <SelectItem value='template-standard-9-5' disabled>
                    Standard 9–5 (coming soon)
                  </SelectItem>
                  <SelectItem value='template-two-shift' disabled>
                    Two-shift rotation (coming soon)
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <p className='text-sm text-muted-foreground'>
              Predefined templates are coming soon — building a custom
              template is fully supported today.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
