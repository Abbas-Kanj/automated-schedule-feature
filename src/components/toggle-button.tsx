import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ToggleButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & {
  selected: boolean
}

// Maps `selected` to Button's `default`/`outline` variants, so grid pickers
// get shadcn's focus-visible/disabled/dark-mode handling for free.
//
// `aria-pressed` carries the state that the variant only shows: without it a
// selected weekday and an unselected one are the same control to a screen
// reader, and to anything else reading the DOM rather than the pixels.
export function ToggleButton({
  selected,
  className,
  ...props
}: ToggleButtonProps) {
  return (
    <Button
      type='button'
      aria-pressed={selected}
      variant={selected ? 'default' : 'outline'}
      className={cn(selected && 'border border-primary', className)}
      {...props}
    />
  )
}
