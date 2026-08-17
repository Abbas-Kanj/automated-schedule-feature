import { ImageIcon, XIcon } from 'lucide-react'
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
  // Break rows always carry an icon (defaults to 'coffee' — see
  // `DEFAULT_BREAK` in `shift-times-tab.tsx`) and have no real "no icon"
  // state worth clearing to, so that usage hides this button; the General
  // tab's own shift icon field keeps it since a shift's icon is optional.
  showClear?: boolean
}

export function IconPickerField({
  value,
  onChange,
  disabled,
  showClear = true,
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
            size='icon'
            disabled={disabled}
            title={selected ? selected.label : 'Select an icon'}
            aria-label={selected ? `Icon: ${selected.label}` : 'Select an icon'}
          >
            {selected && SelectedIcon ? (
              <SelectedIcon className='size-4' />
            ) : (
              <ImageIcon className='size-4 text-muted-foreground' />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-64 p-0'>
          <Command>
            <CommandInput placeholder='Search icons...' />
            <CommandList>
              <CommandEmpty>No icon found.</CommandEmpty>
              {/* cmdk renders a group's items inside a nested
                  `[cmdk-group-items]` div, not the element `className`
                  lands on — target that descendant directly, or a
                  grid/flex layout here is a no-op and icons stay a
                  single-column list. */}
              <CommandGroup className='**:[[cmdk-group-items]]:flex **:[[cmdk-group-items]]:flex-wrap **:[[cmdk-group-items]]:gap-1'>
                {SHIFT_ICON_OPTIONS.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    title={o.label}
                    onSelect={() => onChange(o.value)}
                    className={cn(
                      'w-[18%] flex-none justify-center py-2',
                      value === o.value && 'bg-accent'
                    )}
                  >
                    <o.icon className='size-4' />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled && showClear && (
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
