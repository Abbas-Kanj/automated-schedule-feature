import { useFieldArray, useFormContext } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ToggleButton } from '@/components/toggle-button'
import { type DayOfWeek } from '../../data/schema'
import { TimeRangeFields } from './time-range-fields'

const WEEKDAYS_MON_TO_SUN: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

type WeeklyOneFieldsProps = {
  disabled?: boolean
}

export function WeeklyOneFields({ disabled }: WeeklyOneFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const { fields, append, remove } = useFieldArray({ control, name: 'days' })

  const toggleDay = (day: DayOfWeek, checked: boolean) => {
    const index = fields.findIndex(
      (f) => (f as unknown as { day: string }).day === day
    )
    if (checked && index === -1) {
      append({ day, times: [{ from_time: '09:00', to_time: '17:00' }] })
    } else if (!checked && index > -1) {
      remove(index)
    }
  }

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='days'
        render={() => (
          <FormItem>
            <FormLabel>Days</FormLabel>
            <div className='grid grid-cols-7 gap-1 text-center'>
              {WEEKDAYS_MON_TO_SUN.map((day) => {
                const checked = fields.some(
                  (f) => (f as unknown as { day: string }).day === day
                )
                return (
                  <ToggleButton
                    key={day}
                    selected={checked}
                    disabled={disabled}
                    onClick={() => toggleDay(day, !checked)}
                    className='h-9 w-full px-1 text-sm capitalize'
                  >
                    {day.slice(0, 3)}
                  </ToggleButton>
                )
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {fields.length > 0 && (
        <div className='grid gap-3 sm:grid-cols-2'>
          {fields.map((field, index) => {
            const day = (field as unknown as { day: DayOfWeek }).day
            return (
              <Card key={field.id} className='gap-3 py-3'>
                <CardHeader className='px-3'>
                  <CardTitle className='text-base font-semibold capitalize'>
                    {day}
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-3'>
                  <TimeRangeFields
                    control={control}
                    name={`days.${index}.times`}
                    disabled={disabled}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
