import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DateField } from './date-field'

type ScheduleEndSettingsFieldsProps = {
  disabled?: boolean
}

export function ScheduleEndSettingsFields({
  disabled,
}: ScheduleEndSettingsFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const endType = useWatch({ control, name: 'end_settings.end_type' }) as
    | string
    | undefined

  return (
    <div className='space-y-4'>
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

      <FormField
        control={control}
        name='end_settings.end_type'
        render={({ field }) => (
          <FormItem className='space-y-2'>
            <FormLabel>End settings</FormLabel>
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
                {endType === 'after_occurrences' && (
                  <FormField
                    control={control}
                    name='end_settings.end_occurrences'
                    render={({ field: occurrencesField }) => (
                      <FormItem className='space-y-0'>
                        <div className='flex items-center gap-2'>
                          <FormControl>
                            <Input
                              type='number'
                              min={1}
                              className='h-8 w-24'
                              disabled={disabled}
                              value={occurrencesField.value ?? ''}
                              onChange={(e) =>
                                occurrencesField.onChange(
                                  e.target.valueAsNumber
                                )
                              }
                            />
                          </FormControl>
                          <span className='text-muted-foreground text-sm'>
                            occurrence(s)
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormItem>

              <FormItem className='flex flex-wrap items-center gap-2 space-y-0'>
                <FormControl>
                  <RadioGroupItem value='on_date' />
                </FormControl>
                <FormLabel className='cursor-pointer font-normal'>
                  End on
                </FormLabel>
                {endType === 'on_date' && (
                  <FormField
                    control={control}
                    name='end_settings.end_date'
                    render={({ field: dateField }) => (
                      <FormItem className='space-y-0'>
                        <FormControl>
                          <DateField
                            value={dateField.value}
                            onChange={dateField.onChange}
                            disabled={disabled}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormItem>
            </RadioGroup>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
