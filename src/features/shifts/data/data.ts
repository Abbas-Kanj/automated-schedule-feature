import {
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  CoffeeIcon,
  type LucideIcon,
  MoonIcon,
  ShieldIcon,
  StarIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import { SHIFT_BADGE_COLORS, SHIFT_ICONS } from './schema'

// Tailwind's JIT scanner needs static class strings, so these can't be built
// from a template literal (`bg-${value}-500`) — list them explicitly.
const SHIFT_BADGE_COLOR_SWATCH_CLASSES: Record<
  (typeof SHIFT_BADGE_COLORS)[number],
  string
> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  yellow: 'bg-yellow-500',
  lime: 'bg-lime-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  rose: 'bg-rose-500',
}

export const SHIFT_BADGE_COLOR_OPTIONS = SHIFT_BADGE_COLORS.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
  swatchClassName: SHIFT_BADGE_COLOR_SWATCH_CLASSES[value],
}))

export const SHIFT_ICON_COMPONENTS: Record<
  (typeof SHIFT_ICONS)[number],
  LucideIcon
> = {
  briefcase: BriefcaseIcon,
  clock: ClockIcon,
  sun: SunIcon,
  moon: MoonIcon,
  sunrise: SunriseIcon,
  sunset: SunsetIcon,
  coffee: CoffeeIcon,
  zap: ZapIcon,
  calendar: CalendarIcon,
  users: UsersIcon,
  shield: ShieldIcon,
  star: StarIcon,
}

export const SHIFT_ICON_OPTIONS = SHIFT_ICONS.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
  icon: SHIFT_ICON_COMPONENTS[value],
}))
