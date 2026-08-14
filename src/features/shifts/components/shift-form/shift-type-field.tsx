import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SHIFT_TYPE_OPTIONS } from '../../data/data'
import { type ShiftType } from '../../data/schema'

type ShiftTypeFieldProps = {
  value: ShiftType | undefined
  onChange: (value: ShiftType) => void
  disabled?: boolean
}

export function ShiftTypeField({
  value,
  onChange,
  disabled,
}: ShiftTypeFieldProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as ShiftType)}
      disabled={disabled}
      className='grid-cols-1 gap-2 sm:grid-cols-3'
    >
      {SHIFT_TYPE_OPTIONS.map((option) => (
        <Label
          key={option.value}
          className={cn(
            'flex cursor-pointer flex-col gap-1 rounded-md border p-3 font-normal transition-colors',
            value === option.value && 'border-primary bg-primary/5',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span className='flex items-center gap-2 text-sm font-medium'>
            <RadioGroupItem value={option.value} />
            {option.label}
          </span>
          <span className='text-muted-foreground text-xs'>
            {option.description}
          </span>
        </Label>
      ))}
    </RadioGroup>
  )
}
