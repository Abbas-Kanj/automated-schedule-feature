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
  // Field path prefix — reads/writes `${name}.end_type`, `${name}.end_occurrences`
  // and `${name}.end_date`. Lets `shifts` (`repeat`) and `schedules`
  // (`end_settings`) share this component despite their different field
  // names — same pattern as `RecurrenceFrequencyFields`.
  name: string
  disabled?: boolean
  // Each feature owns its own `DateField` (identical implementations kept
  // separate per-feature — `shifts` is a standalone feature, see
  // CLAUDE.md) — passed in rather than importing one across the feature
  // boundary.
  DateField: React.ComponentType<EndFrequencyDateFieldProps>
}

// Shared "End frequency" block — never ends / ends after N occurrences /
// ends on a specific date. Used by shifts' `RepeatFields` and schedules'
// end-settings/start-end steps alike so both features render the exact
// same component instead of two hand-kept copies.
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
              {/* Always rendered (just disabled until "End after" is the
                  selected option) rather than mounted/unmounted with it —
                  so the field, and its default value, are visible instead
                  of appearing out of nowhere the moment it's selected. */}
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
                      <span className='text-muted-foreground text-sm'>
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
              {/* Same always-rendered/disabled treatment as "End after"
                  above. */}
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
