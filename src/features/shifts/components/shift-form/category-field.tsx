import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SHIFT_CATEGORY_OPTIONS } from '../../data/data'
import { type ShiftCategory } from '../../data/schema'

type CategoryFieldProps = {
  value: ShiftCategory | undefined
  customValue: string | undefined
  onChange: (value: ShiftCategory) => void
  onCustomChange: (value: string) => void
  disabled?: boolean
}

export function CategoryField({
  value,
  customValue,
  onChange,
  onCustomChange,
  disabled,
}: CategoryFieldProps) {
  return (
    <div className='space-y-2'>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ShiftCategory)}
        disabled={disabled}
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Select a category' />
        </SelectTrigger>
        <SelectContent>
          {SHIFT_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === 'custom' && (
        <Input
          placeholder='Custom category name'
          autoComplete='off'
          disabled={disabled}
          value={customValue ?? ''}
          onChange={(e) => onCustomChange(e.target.value)}
        />
      )}
    </div>
  )
}
