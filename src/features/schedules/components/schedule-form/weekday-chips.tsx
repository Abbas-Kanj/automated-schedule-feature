import { type Control, useController } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { DAYS_OF_WEEK, type DayOfWeek } from '../../data/schema'

type WeekdayChipsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  name: string
  disabled?: boolean
}

export function WeekdayChips({ control, name, disabled }: WeekdayChipsProps) {
  const {
    field: { value, onChange },
  } = useController({ control, name })
  const selected: DayOfWeek[] = value ?? []

  const toggle = (day: DayOfWeek) => {
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day]
    )
  }

  return (
    <div className='grid grid-cols-7 gap-1 text-center'>
      {DAYS_OF_WEEK.map((day) => {
        const checked = selected.includes(day)
        return (
          <button
            key={day}
            type='button'
            disabled={disabled}
            onClick={() => toggle(day)}
            className={cn(
              'rounded-md border p-2 text-xs capitalize transition-colors',
              checked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {day.slice(0, 3)}
          </button>
        )
      })}
    </div>
  )
}
