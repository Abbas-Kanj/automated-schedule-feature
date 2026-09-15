import { type Control, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export type EndFrequencyDateFieldProps = {
  value: string | undefined
  onChange: (value: string | undefined) => void
  disabled?: boolean
}

type EndFrequencyFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  // Field path prefix, so `shifts` and `schedules` can share this despite different field names.
  name: string
  disabled?: boolean
  // Passed in rather than imported, since shifts and schedules are separate
  // features each keeping their own DateField implementation.
  DateField: React.ComponentType<EndFrequencyDateFieldProps>
}

export function EndFrequencyFields({
  control,
  name,
  disabled,
  DateField,
}: EndFrequencyFieldsProps) {
  const endType = useWatch({ control, name: `${name}.end_type` }) as
    | string
    | undefined

  return (
    <FormField
      control={control}
      name={`${name}.end_type`}
      render={({ field }) => (
        <FormItem className='space-y-2'>
          <FormLabel>End frequency</FormLabel>
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            disabled={disabled}
            className='gap-2'
          >
            <FormItem className='flex items-center gap-2 space-y-0'>
              <FormControl>
                <RadioGroupItem value='never' />
              </FormControl>
              <FormLabel className='cursor-pointer font-normal'>
                Never ends
              </FormLabel>
            </FormItem>

            <FormItem className='flex flex-wrap items-center gap-2 space-y-0'>
              <FormControl>
                <RadioGroupItem value='after_occurrences' />
              </FormControl>
              <FormLabel className='cursor-pointer font-normal'>
                End after
              </FormLabel>
              {/* Always rendered but disabled, so the field and its default
                  value aren't hidden until this option is selected. */}
              <FormField
                control={control}
                name={`${name}.end_occurrences`}
                render={({ field: occurrencesField }) => (
                  <FormItem className='space-y-0'>
                    <div className='flex items-center gap-2'>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          className='h-8 w-24'
                          disabled={disabled || endType !== 'after_occurrences'}
                          value={occurrencesField.value ?? ''}
                          onChange={(e) =>
                            occurrencesField.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <span className='text-sm text-muted-foreground'>
                        occurrence(s)
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormItem>

            <FormItem className='flex flex-wrap items-center gap-2 space-y-0'>
              <FormControl>
                <RadioGroupItem value='on_date' />
              </FormControl>
              <FormLabel className='cursor-pointer font-normal'>
                End on
              </FormLabel>
              {/* Same always-rendered/disabled treatment as "End after". */}
              <FormField
                control={control}
                name={`${name}.end_date`}
                render={({ field: dateField }) => (
                  <FormItem className='space-y-0'>
                    <FormControl>
                      <DateField
                        value={dateField.value}
                        onChange={dateField.onChange}
                        disabled={disabled || endType !== 'on_date'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormItem>
          </RadioGroup>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
