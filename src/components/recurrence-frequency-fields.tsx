import { type Control, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleButton } from '@/components/toggle-button'

// `disabled` greys the option out while leaving it visible, for frequencies
// not yet supported.
export type RecurrenceOption = {
  value: string
  label: string
  disabled?: boolean
}

type RecurrenceWeekdayChipsProps = {
  options: RecurrenceOption[]
  value: string[] | undefined
  onChange: (value: string[]) => void
  disabled?: boolean
  // Replaces the selection instead of toggling, for frequencies that only allow one day.
  single?: boolean
}

// Exported for reuse outside this component's daily/weekly block (e.g. shifts'
// monthly "day position" sub-mode).
export function RecurrenceWeekdayChips({
  options,
  value,
  onChange,
  disabled,
  single,
}: RecurrenceWeekdayChipsProps) {
  const selected = value ?? []

  const toggle = (day: string) => {
    if (single) {
      onChange([day])
      return
    }
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day]
    )
  }

  return (
    <div className='grid grid-cols-7 gap-1 text-center'>
      {options.map((day) => {
        const checked = selected.includes(day.value)
        return (
          <ToggleButton
            key={day.value}
            selected={checked}
            disabled={disabled || day.disabled}
            onClick={() => toggle(day.value)}
            className='h-9 w-full px-1 text-xs'
          >
            {day.label}
          </ToggleButton>
        )
      })}
    </div>
  )
}

type RecurrenceFrequencyFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  // Field path prefix, so `shifts` and `schedules` can share this despite different field names.
  name: string
  frequencyOptions: RecurrenceOption[]
  weekdayOptions: RecurrenceOption[]
  weeklySingleDay?: boolean
  disabled?: boolean
  // Monthly sub-mode fields differ enough per feature (day range vs.
  // day-of-month/date/day-position) that each feature still owns them.
  monthlyFields?: React.ReactNode
}

export function RecurrenceFrequencyFields({
  control,
  name,
  frequencyOptions,
  weekdayOptions,
  weeklySingleDay,
  disabled,
  monthlyFields,
}: RecurrenceFrequencyFieldsProps) {
  const frequency = useWatch({ control, name: `${name}.frequency` }) as
    | string
    | undefined

  return (
    <div className='space-y-3'>
      <FormField
        control={control}
        name={`${name}.frequency`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Repeat frequency</FormLabel>
            <Select
              value={field.value}
              // Radix's hidden native <select> can re-emit an empty value via
              // onValueChange right after a programmatic set (before it has a
              // matching <option>), wiping the value a frame later. A real
              // user pick is never empty, so drop empty values here.
              onValueChange={(value) => {
                if (!value) return
                field.onChange(value)
              }}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a frequency' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {(frequency === 'daily' ||
        frequency === 'weekly' ||
        frequency === 'monthly') && (
        <FormField
          control={control}
          name={`${name}.interval`}
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center gap-2'>
                <FormLabel className='shrink-0'>Repeat every</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    className='w-24'
                    disabled={disabled}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <span className='text-sm text-muted-foreground'>
                  {frequency === 'daily'
                    ? 'day(s)'
                    : frequency === 'weekly'
                      ? 'week(s)'
                      : 'month(s)'}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {frequency === 'weekly' && (
        <FormField
          control={control}
          name={`${name}.weekdays`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {weeklySingleDay ? 'Repeat on which day' : 'Repeat on'}
              </FormLabel>
              <RecurrenceWeekdayChips
                options={weekdayOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                single={weeklySingleDay}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {frequency === 'monthly' && monthlyFields}
    </div>
  )
}
