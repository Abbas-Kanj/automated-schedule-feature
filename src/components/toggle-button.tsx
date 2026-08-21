import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ToggleButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & {
  selected: boolean
}

// The "pick one or more out of a grid" button this app repeats everywhere —
// weekday grids, month-day grids, cycle-length pickers, the shift form's
// day toggles. Selected maps to Button's `default` variant and unselected
// to `outline`, so every grid gets shadcn's focus-visible ring, disabled
// handling and dark-mode treatment instead of each one hand-rolling
// `bg-primary text-primary-foreground` + `hover:bg-accent` itself.
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
