import { type Control, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
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

export type RecurrenceOption = { value: string; label: string }

type RecurrenceWeekdayChipsProps = {
  options: RecurrenceOption[]
  value: string[] | undefined
  onChange: (value: string[]) => void
  disabled?: boolean
  // Replaces the selection instead of toggling a day into a multi-select —
  // used for frequencies that only allow one day (e.g. shifts' "weekly").
  single?: boolean
}

function RecurrenceWeekdayChips({
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
          <button
            key={day.value}
            type='button'
            disabled={disabled}
            onClick={() => toggle(day.value)}
            className={cn(
              'rounded-md border p-2 text-xs transition-colors',
              checked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {day.label}
          </button>
        )
      })}
    </div>
  )
}

type RecurrenceFrequencyFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  // Field path prefix — reads/writes `${name}.frequency`, `${name}.interval`
  // and `${name}.weekdays`. Lets `shifts` (repeat) and `schedules`
  // (recurrence) share this component despite their different field names.
  name: string
  frequencyOptions: RecurrenceOption[]
  weekdayOptions: RecurrenceOption[]
  // Weekly only allows one selected day when true (see
  // `RecurrenceWeekdayChips`'s `single` mode).
  weeklySingleDay?: boolean
  disabled?: boolean
  // Rendered in place of this component's own daily/weekly UI once
  // frequency === 'monthly' — monthly's shape differs enough between
  // features (a simple day range vs. day-of-month/date-specific/
  // day-position sub-modes) that each feature still owns it.
  monthlyFields?: React.ReactNode
}

// Shared "Repeat frequency" + "Repeat every" + "Repeat on" block for a
// daily/weekly/monthly recurrence rule. Used by both `shifts`' RepeatFields
// and `schedules`' RecurrenceFrequencyFields — see each for its own
// monthly-specific fields, passed in via `monthlyFields`.
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
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a frequency' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {frequencyOptions.map((option) => (
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

      {(frequency === 'daily' || frequency === 'weekly') && (
        <FormField
          control={control}
          name={`${name}.interval`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repeat every</FormLabel>
              <div className='flex items-center gap-2'>
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
                <span className='text-muted-foreground text-sm'>
                  {frequency === 'daily' ? 'day(s)' : 'week(s)'}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {(frequency === 'daily' || frequency === 'weekly') && (
        <FormField
          control={control}
          name={`${name}.weekdays`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {frequency === 'weekly' && weeklySingleDay
                  ? 'Repeat on which day'
                  : 'Repeat on'}
              </FormLabel>
              <RecurrenceWeekdayChips
                options={weekdayOptions}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                single={frequency === 'weekly' && weeklySingleDay}
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
