import { useFormContext } from 'react-hook-form'
import { EndFrequencyFields } from '@/components/end-frequency-fields'
import {
  RecurrenceFrequencyFields,
  type RecurrenceOption,
} from '@/components/recurrence-frequency-fields'
import { RepeatMonthlyFields } from '@/components/repeat-monthly-fields'
import {
  DAY_LABELS,
  REPEAT_FREQUENCY_OPTIONS,
  REPEAT_MONTHLY_MODE_OPTIONS,
} from '../../data/data'
import { DAYS_OF_WEEK } from '../../data/schema'
import { DateField } from './date-field'

type RepeatFieldsProps = {
  disabled?: boolean
}

// The frequency picker's weekday chips — shared with `schedules`' own
// recurrence fields via `RecurrenceFrequencyFields` (see
// `@/components/recurrence-frequency-fields`).
const WEEKDAY_OPTIONS: RecurrenceOption[] = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: DAY_LABELS[day],
}))

export function RepeatFields({ disabled }: RepeatFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()

  return (
    <div className='space-y-4'>
      <RecurrenceFrequencyFields
        control={control}
        name='repeat'
        frequencyOptions={REPEAT_FREQUENCY_OPTIONS}
        weekdayOptions={WEEKDAY_OPTIONS}
        disabled={disabled}
        monthlyFields={
          <RepeatMonthlyFields
            control={control}
            name='repeat'
            monthlyModeOptions={REPEAT_MONTHLY_MODE_OPTIONS}
            weekdayOptions={WEEKDAY_OPTIONS}
            disabled={disabled}
          />
        }
      />

      <EndFrequencyFields
        control={control}
        name='repeat'
        disabled={disabled}
        DateField={DateField}
      />
    </div>
  )
}
