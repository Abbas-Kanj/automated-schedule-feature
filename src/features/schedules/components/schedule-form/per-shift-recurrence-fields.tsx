import { useEffect } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type RecurrenceOption,
  RecurrenceFrequencyFields,
} from '@/components/recurrence-frequency-fields'
import { RepeatMonthlyFields } from '@/components/repeat-monthly-fields'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { SHIFT_ICON_COMPONENTS } from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import {
  SHIFT_REPEAT_MONTHLY_MODE_OPTIONS,
  SHIFT_REPEAT_WEEKDAY_OPTIONS,
} from '../../data/data'

type ShiftRuleRow = { shift_id: string }

type PerShiftRecurrenceFieldsProps = {
  // The field array holding one rule per selected shift — rotate's
  // `shift_repeat`, fixed's `shift_occurrences`.
  name: string
  title: string
  shiftIds: string[]
  frequencyOptions: RecurrenceOption[]
  // What a newly selected shift starts with; must already be valid.
  defaultRule: Record<string, unknown>
  disabled?: boolean
}

// One frequency block per selected shift, each shift repeating on its own
// rule. Rows follow the shift selection, keeping settings already made.
export function PerShiftRecurrenceFields({
  name,
  title,
  shiftIds,
  frequencyOptions,
  defaultRule,
  disabled,
}: PerShiftRecurrenceFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const { fields, replace } = useFieldArray({ control, name })

  const shiftIdsKey = shiftIds.join(',')
  useEffect(() => {
    const current = (getValues(name) as ShiftRuleRow[] | undefined) ?? []
    const next = shiftIds.map(
      (id) =>
        current.find((r) => r.shift_id === id) ?? {
          ...defaultRule,
          shift_id: id,
        }
    )
    const changed =
      next.length !== current.length ||
      next.some((r, i) => r.shift_id !== current[i]?.shift_id)
    if (changed) replace(next)
  }, [shiftIdsKey])

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-base font-semibold'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4'>
        {/* Rows come from the field array, not `shiftIds`: a row mounted
            before the effect above writes its rule would hand the Radix
            Select an undefined value, and it keeps showing the placeholder
            once the real one arrives. */}
        {(fields as unknown as ({ id: string } & ShiftRuleRow)[]).map(
          ({ id, shift_id: shiftId }, index) => {
            const shift = shifts.find((s) => s.id === shiftId)
            const Icon = shift ? SHIFT_ICON_COMPONENTS[shift.icon] : undefined
            return (
              <div key={id} className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <ShiftSwatch shift={shift} size='md' />
                  {Icon && (
                    <Icon className='size-4 shrink-0 text-muted-foreground' />
                  )}
                  <p className='text-sm font-medium'>
                    {shift?.name ?? 'Shift'}
                  </p>
                </div>
                <RecurrenceFrequencyFields
                  control={control}
                  name={`${name}.${index}`}
                  frequencyOptions={frequencyOptions}
                  weekdayOptions={SHIFT_REPEAT_WEEKDAY_OPTIONS}
                  disabled={disabled}
                  monthlyFields={
                    <RepeatMonthlyFields
                      control={control}
                      name={`${name}.${index}`}
                      monthlyModeOptions={SHIFT_REPEAT_MONTHLY_MODE_OPTIONS}
                      weekdayOptions={SHIFT_REPEAT_WEEKDAY_OPTIONS}
                      disabled={disabled}
                    />
                  }
                />
              </div>
            )
          }
        )}
        {/* Row-count errors ("every selected shift needs a rule") land on the
            array itself, not on any one row. */}
        <ArrayError name={name} />
      </CardContent>
    </Card>
  )
}

function ArrayError({ name }: { name: string }) {
  const {
    formState: { errors },
  } = useFormContext()
  const message = errors[name]?.message
  if (typeof message !== 'string') return null
  return <p className='text-sm font-medium text-destructive'>{message}</p>
}
