import { cn } from '@/lib/utils'
import { SHIFT_BADGE_COLOR_OPTIONS } from '../data/data'
import { type Shift } from '../data/schema'

const SWATCH_SIZES = {
  sm: 'size-1.5',
  md: 'size-2',
  lg: 'size-2.5',
} as const

type ShiftSwatchProps = {
  shift?: Pick<Shift, 'badge_color'>
  size?: keyof typeof SWATCH_SIZES
  className?: string
}

// The coloured dot standing in for a shift wherever one is named — grid cells,
// pattern cards, pickers, summaries. Owns the badge-colour lookup so no call
// site has to repeat it, and falls back to a muted dot for a shift with no
// colour so the row does not lose its bullet.
export function ShiftSwatch({
  shift,
  size = 'sm',
  className,
}: ShiftSwatchProps) {
  const color = SHIFT_BADGE_COLOR_OPTIONS.find(
    (option) => option.value === shift?.badge_color
  )
  return (
    <span
      className={cn(
        'shrink-0 rounded-full',
        SWATCH_SIZES[size],
        color?.swatchClassName ?? 'bg-muted-foreground/40',
        className
      )}
    />
  )
}
