import { CalendarIcon, ChevronsUpDownIcon } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { GLOBAL_TIMEZONES, LOCAL_TIMEZONE } from '../../data/data'
import { type ShiftTimezoneMode } from '../../data/schema'

type TimezoneFieldProps = {
  mode: ShiftTimezoneMode | undefined
  value: string | undefined
  onModeChange: (mode: ShiftTimezoneMode) => void
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function TimezoneField({
  mode,
  value,
  onModeChange,
  onValueChange,
  disabled,
}: TimezoneFieldProps) {
  return (
    <RadioGroup
      value={mode}
      onValueChange={(v) => onModeChange(v as ShiftTimezoneMode)}
      disabled={disabled}
      className='gap-2'
    >
      <Label
        className={cn(
          'flex cursor-pointer items-center justify-between gap-2 rounded-md border p-3 font-normal',
          mode === 'local' && 'border-primary bg-primary/5',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className='flex items-center gap-2'>
          <RadioGroupItem value='local' />
          Local
        </span>
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <CalendarIcon className='size-3.5' />
          {LOCAL_TIMEZONE}
        </span>
      </Label>

      <div
        className={cn(
          'rounded-md border p-3',
          mode === 'global' && 'border-primary bg-primary/5',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Label className='flex cursor-pointer items-center gap-2 font-normal'>
          <RadioGroupItem value='global' />
          Global
        </Label>
        {mode === 'global' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                disabled={disabled}
                className='mt-2 w-full justify-between font-normal'
              >
                <span className='truncate'>
                  {value ?? 'Select a time zone'}
                </span>
                <ChevronsUpDownIcon className='text-muted-foreground size-4 shrink-0' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-72 p-0'>
              <Command>
                <CommandInput placeholder='Search time zones...' />
                <CommandList>
                  <CommandEmpty>No time zone found.</CommandEmpty>
                  <CommandGroup>
                    {GLOBAL_TIMEZONES.map((tz) => (
                      <CommandItem
                        key={tz}
                        value={tz}
                        onSelect={() => onValueChange(tz)}
                        className={cn(value === tz && 'bg-accent')}
                      >
                        {tz}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </RadioGroup>
  )
}
