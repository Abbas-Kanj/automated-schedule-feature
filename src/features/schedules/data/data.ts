import {
  BriefcaseIcon,
  Building2Icon,
  CalendarIcon,
  ClockIcon,
  CoffeeIcon,
  FlagIcon,
  HomeIcon,
  type LucideIcon,
  MoonIcon,
  ShieldIcon,
  StarIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
  TruckIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import {
  BADGE_COLORS,
  DAYS_OF_WEEK,
  SCHEDULE_ICONS,
  SHIFT_REPEAT_WEEKDAYS,
  type CYCLE_LENGTH_UNITS,
  type CYCLE_TYPES,
  type OCCURRENCE_FREQUENCIES,
  type RECURRENCE_END_TYPES,
  type REGULAR_TYPES,
  type ShiftRepeatFrequency,
  type ShiftRepeatMonthlyMode,
} from './schema'

export const DAY_OPTIONS = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: day.charAt(0).toUpperCase() + day.slice(1),
}))

export const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export const SCHEDULE_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekly_one', label: 'Weekly One' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const REGULAR_TYPE_OPTIONS = [
  {
    value: 'fixed',
    label: 'Fixed',
    description: 'One or more shifts with the same days and times every week.',
  },
  {
    value: 'rotate',
    label: 'Rotate',
    description:
      'A recurring cycle of shifts and days off that rotates over time.',
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description:
      'Shift times that employees can adjust within the assigned days.',
  },
] satisfies {
  value: (typeof REGULAR_TYPES)[number]
  label: string
  description: string
}[]

// Tailwind's JIT scanner needs static class strings, so these can't be built
// from a template literal (`bg-${value}-500`) — list them explicitly.
const BADGE_COLOR_SWATCH_CLASSES: Record<
  (typeof BADGE_COLORS)[number],
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

export const BADGE_COLOR_OPTIONS = BADGE_COLORS.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
  swatchClassName: BADGE_COLOR_SWATCH_CLASSES[value],
}))

export const SCHEDULE_ICON_COMPONENTS: Record<
  (typeof SCHEDULE_ICONS)[number],
  LucideIcon
> = {
  briefcase: BriefcaseIcon,
  clock: ClockIcon,
  sun: SunIcon,
  moon: MoonIcon,
  sunrise: SunriseIcon,
  sunset: SunsetIcon,
  coffee: CoffeeIcon,
  'building-2': Building2Icon,
  users: UsersIcon,
  calendar: CalendarIcon,
  shield: ShieldIcon,
  zap: ZapIcon,
  star: StarIcon,
  flag: FlagIcon,
  home: HomeIcon,
  truck: TruckIcon,
}

export const SCHEDULE_ICON_OPTIONS = SCHEDULE_ICONS.map((value) => ({
  value,
  label: value
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
  icon: SCHEDULE_ICON_COMPONENTS[value],
}))

export const CYCLE_TYPE_OPTIONS = [
  {
    value: 'pattern_shifts',
    label: 'Rotate pattern',
    description: 'Assign a shift or day off to each day of the cycle directly.',
  },
  {
    value: 'custom_shifts',
    label: 'Custom alternate',
    description:
      'Set a repeat frequency for each shift, then edit the auto-generated pattern.',
  },
] satisfies {
  value: (typeof CYCLE_TYPES)[number]
  label: string
  description: string
}[]

// "Monthly" stays greyed out, not removed — nothing downstream honours real
// calendar months yet (see `CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS`). Same reasoning
// for every other `disabled: true` monthly option here and in
// `shifts/data/data.ts`; existing monthly data still renders.
export const CYCLE_LENGTH_UNIT_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly', disabled: true },
  { value: 'custom_days', label: 'Custom days' },
] satisfies {
  value: (typeof CYCLE_LENGTH_UNITS)[number]
  label: string
  disabled?: boolean
}[]

export const CYCLE_LENGTH_QUICK_PICKS = [6, 8, 10]
// export const CYCLE_LENGTH_QUICK_PICKS = [7, 14, 6, 28, 35]

// Converts a UI week/month count to the stored day count. A "month" is
// always a flat 30 days, not the calendar month's real length. Custom-days
// cycles skip this and store the day count directly.
export const CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS: Partial<
  Record<(typeof CYCLE_LENGTH_UNITS)[number], number>
> = {
  weekly: 7,
  monthly: 30,
}

export const RECURRENCE_END_TYPE_OPTIONS = [
  { value: 'never', label: 'Never ends' },
  { value: 'after_occurrences', label: 'End after' },
  { value: 'on_date', label: 'End on' },
] satisfies { value: (typeof RECURRENCE_END_TYPES)[number]; label: string }[]

// Unlike the other monthly options above, monthly is selectable here —
// `occurrencePattern` reads it via the same flat 30-day approximation.
export const OCCURRENCE_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] satisfies {
  value: (typeof OCCURRENCE_FREQUENCIES)[number]
  label: string
  disabled?: boolean
}[]

export const SHIFT_REPEAT_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly', disabled: true },
] satisfies {
  value: ShiftRepeatFrequency
  label: string
  disabled?: boolean
}[]

// Mirrors shifts' own `DAY_LABELS`/`REPEAT_MONTHLY_MODE_OPTIONS`
// (`shifts/data/data.ts`) — both render the same shared
// `RecurrenceFrequencyFields`/`RepeatMonthlyFields`.
const SHIFT_REPEAT_DAY_LABELS: Record<
  (typeof SHIFT_REPEAT_WEEKDAYS)[number],
  string
> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export const SHIFT_REPEAT_WEEKDAY_OPTIONS = SHIFT_REPEAT_WEEKDAYS.map(
  (day) => ({
    value: day,
    label: SHIFT_REPEAT_DAY_LABELS[day],
  })
)

export const SHIFT_REPEAT_MONTHLY_MODE_OPTIONS = [
  { value: 'day_month', label: 'Day of month' },
  { value: 'date_specific', label: 'Date specific' },
  { value: 'day_position', label: 'Day position' },
] satisfies { value: ShiftRepeatMonthlyMode; label: string }[]
