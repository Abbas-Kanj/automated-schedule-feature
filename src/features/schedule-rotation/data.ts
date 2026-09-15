import { SHIFT_BADGE_COLOR_OPTIONS } from '@/features/shifts/data/data'
import { type ShiftBadgeColor } from '@/features/shifts/data/schema'
import { type TimelineSpan } from './timeline'

export const SPAN_OPTIONS: { value: TimelineSpan; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

// Full class strings spelled out, not templated (`bg-${color}-100`) — Tailwind's
// JIT scanner can't see through string interpolation.
export const SHIFT_SOFT_BADGE_CLASSES: Record<ShiftBadgeColor, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  orange:
    'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  yellow:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300',
  lime: 'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  indigo:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  purple:
    'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

export const OFF_BADGE_CLASS = 'bg-muted text-muted-foreground dark:bg-muted/50'

// Derived from the shift form's own swatches, not redefined, so a dot is
// always the same color the shift wears everywhere else.
export const SHIFT_DOT_CLASSES = Object.fromEntries(
  SHIFT_BADGE_COLOR_OPTIONS.map((option) => [
    option.value,
    option.swatchClassName,
  ])
) as Record<ShiftBadgeColor, string>

// An empty ring, not a grey disc — rest should recede rather than compete
// visually with the shift colors.
export const OFF_DOT_CLASS = 'border-2 border-muted-foreground/35'
