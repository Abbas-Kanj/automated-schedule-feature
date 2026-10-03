import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ToggleButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & {
  selected: boolean
}

// Maps `selected` to Button's `default`/`outline` variants. `aria-pressed`
// carries the selected state for screen readers.
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
