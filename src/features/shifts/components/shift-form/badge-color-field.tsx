import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SHIFT_BADGE_COLOR_OPTIONS } from '../../data/data'
import { type ShiftBadgeColor } from '../../data/schema'

type BadgeColorFieldProps = {
  value: ShiftBadgeColor | undefined
  onChange: (value: ShiftBadgeColor | undefined) => void
  disabled?: boolean
}

export function BadgeColorField({
  value,
  onChange,
  disabled,
}: BadgeColorFieldProps) {
  const selected = SHIFT_BADGE_COLOR_OPTIONS.find((o) => o.value === value)

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
            {selected ? (
              <>
                <span
                  className={cn(
                    'size-3 rounded-full',
                    selected.swatchClassName
                  )}
                />
                {selected.label}
              </>
            ) : (
              <span className='text-muted-foreground'>Select a color</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-56 p-2'>
          <div className='grid grid-cols-4 gap-2'>
            {SHIFT_BADGE_COLOR_OPTIONS.map((o) => (
              <Button
                key={o.value}
                type='button'
                variant='ghost'
                size='icon'
                title={o.label}
                onClick={() => onChange(o.value)}
                className={cn(
                  'size-8 rounded-full ring-offset-2 transition-shadow hover:opacity-80',
                  o.swatchClassName,
                  // The swatch IS the colour, so keep Button's hover/active
                  // background from painting over it.
                  'hover:bg-[unset] dark:hover:bg-[unset]',
                  value === o.value && 'ring-ring ring-2'
                )}
              />
            ))}
          </div>
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
