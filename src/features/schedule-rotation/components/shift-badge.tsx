import { cn } from '@/lib/utils'
import { SHIFT_ICON_COMPONENTS } from '@/features/shifts/data/data'
import { OFF_BADGE_CLASS, SHIFT_SOFT_BADGE_CLASSES } from '../data'
import { type RotationPosition } from '../utils'

type ShiftBadgeProps = {
  position: RotationPosition
  className?: string
}

// The soft, colored pill used for a resolved rotation position (a shift or
// an off day) — its color comes from the shift's own `badge_color`, its icon
// from the shift's `icon`.
export function ShiftBadge({ position, className }: ShiftBadgeProps) {
  const Icon = position.shift
    ? SHIFT_ICON_COMPONENTS[position.shift.icon]
    : undefined

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        position.isOff || !position.badgeColor
          ? OFF_BADGE_CLASS
          : SHIFT_SOFT_BADGE_CLASSES[position.badgeColor],
        className
      )}
    >
      {Icon && <Icon className='size-3.5 shrink-0' />}
      {position.label}
    </span>
  )
}
