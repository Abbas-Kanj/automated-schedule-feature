import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ToggleButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & {
  selected: boolean
}

// Maps `selected` to Button's `default`/`outline` variants, so grid pickers
// get shadcn's focus-visible/disabled/dark-mode handling for free.
export function ToggleButton({
  selected,
  className,
  ...props
}: ToggleButtonProps) {
  return (
    <Button
      type='button'
      variant={selected ? 'default' : 'outline'}
      className={cn(selected && 'border border-primary', className)}
      {...props}
    />
  )
}
