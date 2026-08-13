import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SHIFT_ICON_OPTIONS } from '../../data/data'
import { type ShiftIcon } from '../../data/schema'

type IconPickerFieldProps = {
  value: ShiftIcon | undefined
  onChange: (value: ShiftIcon | undefined) => void
  disabled?: boolean
}

export function IconPickerField({
  value,
  onChange,
  disabled,
}: IconPickerFieldProps) {
  const selected = SHIFT_ICON_OPTIONS.find((o) => o.value === value)
  const SelectedIcon = selected?.icon

  return (
    <div className='flex items-center gap-2'>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            disabled={disabled}
            className='justify-start gap-2'
          >
            {selected && SelectedIcon ? (
              <>
                <SelectedIcon className='size-4' />
                {selected.label}
              </>
            ) : (
              <span className='text-muted-foreground'>Select an icon</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-56 p-0'>
          <Command>
            <CommandInput placeholder='Search icons...' />
            <CommandList>
              <CommandEmpty>No icon found.</CommandEmpty>
              <CommandGroup>
                {SHIFT_ICON_OPTIONS.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => onChange(o.value)}
                    className={cn(value === o.value && 'bg-accent')}
                  >
                    <o.icon className='size-4' />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={() => onChange(undefined)}
        >
          <XIcon className='size-4' />
        </Button>
      )}
    </div>
  )
}
