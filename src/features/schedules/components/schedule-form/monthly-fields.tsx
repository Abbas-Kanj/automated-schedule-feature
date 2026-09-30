import {
  type Control,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleButton } from '@/components/toggle-button'
import { MONTHS } from '../../data/data'
import { type Schedule } from '../../data/schema'
import { getDaysInMonthArray } from '../../utils'
import { TimeRangeFields } from './time-range-fields'

type MonthlyFieldsProps = {
  disabled?: boolean
}

export function MonthlyFields({ disabled }: MonthlyFieldsProps) {
  const { control } = useFormContext<Schedule>()
  const year = useWatch({ control, name: 'year' })
  const {
    fields: monthFields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: 'months',
  })

  const toggleMonth = (month: number, checked: boolean) => {
    const index = monthFields.findIndex((f) => f.month === month)
    if (checked && index === -1) {
      append({ month, days: [] })
    } else if (!checked && index > -1) {
      remove(index)
    }
  }

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='year'
        render={({ field }) => (
          <FormItem className='max-w-40'>
            <FormLabel>Year</FormLabel>
            <FormControl>
              <Input
                type='number'
                disabled={disabled}
                {...field}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='months'
        render={() => (
          <FormItem>
            <FormLabel>Months</FormLabel>
            <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
              {MONTHS.map((month) => {
                const monthNum = Number(month.value)
                const checked = monthFields.some((f) => f.month === monthNum)
                return (
                  <Label
                    key={month.value}
                    className={cn(
                      'cursor-pointer rounded-md border px-3 py-2 font-normal',
                      checked && 'border-primary'
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) =>
                        toggleMonth(monthNum, !!value)
                      }
                    />
                    {month.label}
                  </Label>
                )
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {monthFields.map((monthField, monthIndex) => (
        <MonthDaysCard
          key={monthField.id}
          control={control}
          monthIndex={monthIndex}
          month={monthField.month}
          year={year}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

type MonthDaysCardProps = {
  control: Control<Schedule>
  monthIndex: number
  month: number
  year: number
  disabled?: boolean
}

function MonthDaysCard({
  control,
  monthIndex,
  month,
  year,
  disabled,
}: MonthDaysCardProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `months.${monthIndex}.days`,
  })
  const days = year ? getDaysInMonthArray(year, month) : []
  const monthLabel = MONTHS.find((m) => Number(m.value) === month)?.label

  const toggleDay = (day: number, checked: boolean) => {
    const index = fields.findIndex((f) => f.day === day)
    if (checked && index === -1) {
      append({ day, times: [{ from_time: '09:00', to_time: '17:00' }] })
    } else if (!checked && index > -1) {
      remove(index)
    }
  }

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-base font-semibold'>{monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4'>
        <div className='grid grid-cols-7 gap-1.5'>
          {days.map((day) => {
            const checked = fields.some((f) => f.day === day)
            return (
              <ToggleButton
                key={day}
                selected={checked}
                disabled={disabled}
                onClick={() => toggleDay(day, !checked)}
                className='size-8 p-0 text-xs'
              >
                {day}
              </ToggleButton>
            )
          })}
        </div>
        {fields.map((dayField, dayIndex) => (
          <div key={dayField.id} className='space-y-1'>
            <p className='text-xs font-medium text-muted-foreground'>
              Day {dayField.day}
            </p>
            <TimeRangeFields
              control={control}
              name={`months.${monthIndex}.days.${dayIndex}.times`}
              disabled={disabled}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
