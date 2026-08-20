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

// Exported for reuse anywhere else a single row of spread-out day chips is
// needed outside this component's own daily/weekly block — e.g. shifts'
// monthly "day position" sub-mode (single-select, like `weeklySingleDay`).
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
  // Rendered below this component's own "Repeat every" once
  // frequency === 'monthly' — everything past that point differs enough
  // between features (a simple day range vs. day-of-month/date-specific/
  // day-position sub-modes) that each feature still owns it.
  monthlyFields?: React.ReactNode
}

// Shared "Repeat frequency" + "Repeat every" + "Repeat on" block for a
// daily/weekly/monthly recurrence rule. "Repeat every" always shows right
// under the frequency dropdown regardless of which of the three is picked
// (day(s)/week(s)/month(s)) — same pattern for all three, so monthly's own
// `monthlyFields` never needs to render its own copy. "Repeat on" (the
// weekday picker, single- or multi-select per `weeklySingleDay`) only ever
// shows for weekly. Used by `shifts`' RepeatFields and schedules' rotate
// "Custom alternate" per-shift repeat rows alike — each passes its own
// monthly-specific fields via `monthlyFields` (typically the shared
// `RepeatMonthlyFields`, see `@/components/repeat-monthly-fields`).
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
                <span className='text-muted-foreground text-sm'>
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
