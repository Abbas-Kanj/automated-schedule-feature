import { Loader, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormControl } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type SelectDropdownProps = {
  onValueChange?: (value: string) => void
  defaultValue: string | undefined
  placeholder?: string
  isPending?: boolean
  // `icon` is optional per-item — only rotate's per-day shift picker uses it
  // today (see `pattern-builder.tsx`), every other call site keeps passing
  // plain `{ label, value }` pairs.
  items: { label: string; value: string; icon?: LucideIcon }[] | undefined
  disabled?: boolean
  className?: string
  isControlled?: boolean
}

export function SelectDropdown({
  defaultValue,
  onValueChange,
  isPending,
  items,
  placeholder,
  disabled,
  className = '',
  isControlled = false,
}: SelectDropdownProps) {
  const defaultState = isControlled
    ? { value: defaultValue, onValueChange }
    : { defaultValue, onValueChange }
  return (
    <Select {...defaultState}>
      <FormControl>
        <SelectTrigger disabled={disabled} className={cn(className)}>
          <SelectValue placeholder={placeholder ?? 'Select'} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {isPending ? (
          <SelectItem disabled value='loading' className='h-14'>
            <div className='flex items-center justify-center gap-2'>
              <Loader className='h-5 w-5 animate-spin' />
              {'  '}
              Loading...
            </div>
          </SelectItem>
        ) : (
          items?.map(({ label, value, icon: Icon }) => (
            <SelectItem key={value} value={value}>
              {Icon ? (
                <span className='flex items-center gap-2'>
                  <Icon className='size-4 shrink-0 text-muted-foreground' />
                  {label}
                </span>
              ) : (
                label
              )}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
