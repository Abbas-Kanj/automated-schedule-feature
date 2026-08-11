import { Plus, Trash2 } from 'lucide-react'
import { type Control, useFieldArray, useWatch } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type TimeRange } from '../../data/schema'
import { calculateHours } from '../../utils'

type TimeRangeFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  name: string
  disabled?: boolean
  // When set, the range count is externally controlled (e.g. by a split
  // number elsewhere in the form) so add/remove controls are hidden.
  fixedCount?: boolean
}

export function TimeRangeFields({
  control,
  name,
  disabled,
  fixedCount,
}: TimeRangeFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name })
  const times = (useWatch({ control, name }) as TimeRange[] | undefined) ?? []
  const hours = calculateHours(times)

  return (
    <div className='space-y-2'>
      {fields.map((field, index) => (
        <div key={field.id} className='flex items-start gap-2'>
          <FormField
            control={control}
            name={`${name}.${index}.from_time`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormControl>
                  <Input
                    type='time'
                    disabled={disabled}
                    max={times[index]?.to_time || undefined}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <span className='text-muted-foreground pt-2 text-sm'>to</span>
          <FormField
            control={control}
            name={`${name}.${index}.to_time`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormControl>
                  <Input
                    type='time'
                    disabled={disabled}
                    min={times[index]?.from_time || undefined}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!disabled && !fixedCount && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='mt-0.5'
              disabled={fields.length === 1}
              onClick={() => remove(index)}
            >
              <Trash2 className='size-4' />
            </Button>
          )}
        </div>
      ))}
      <div className='flex items-center justify-between'>
        {!disabled && !fixedCount && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => append({ from_time: '09:00', to_time: '17:00' })}
          >
            <Plus className='size-4' /> Add time range
          </Button>
        )}
        <Badge variant='secondary'>{hours}h total</Badge>
      </div>
    </div>
  )
}
