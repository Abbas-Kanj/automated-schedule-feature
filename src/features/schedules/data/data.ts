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
  POLICY_TYPES,
  SCHEDULE_ICONS,
  type CYCLE_LENGTH_UNITS,
  type CYCLE_TYPES,
  type PolicyType,
  type RECURRENCE_END_TYPES,
  type REGULAR_TYPES,
  type ROTATE_DIRECTIONS,
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

export const POLICY_TYPE_OPTIONS = POLICY_TYPES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

export type PolicyDetail = {
  summary: string
  sections: { title: string; content: string }[]
}

export const POLICY_DETAILS: Record<PolicyType, PolicyDetail> = {
  standard: {
    summary: 'Default working hours and leave rules for most employees.',
    sections: [
      {
        title: 'Overview',
        content:
          'Applies the organization’s default working-hours and leave rules. Best suited for most roles that don’t need a custom arrangement.',
      },
      {
        title: 'Attendance rules',
        content:
          'Clock-in/clock-out is expected within a 15-minute grace window of the scheduled shift time. Repeated late arrivals are flagged for manager review.',
      },
      {
        title: 'Leave & exceptions',
        content:
          'Standard annual/sick leave accrual applies. Public holidays and approved sick leave are automatically excluded from the schedule.',
      },
    ],
  },
  flexible: {
    summary: 'Allows flexible start/end times within core working hours.',
    sections: [
      {
        title: 'Overview',
        content:
          'Employees can shift their start and end times as long as they cover the defined core hours and meet their total daily/weekly hours.',
      },
      {
        title: 'Attendance rules',
        content:
          'No fixed clock-in time is enforced outside of core hours. Total hours worked are still tracked against the shift length.',
      },
      {
        title: 'Leave & exceptions',
        content:
          'Leave and public-holiday exceptions still apply, but employees may make up missed core-hour time within the same week.',
      },
    ],
  },
  strict: {
    summary: 'Enforces exact clock-in/clock-out times with no tolerance.',
    sections: [
      {
        title: 'Overview',
        content:
          'Used for roles with hard coverage requirements (e.g. front desk, security). Shift times are enforced exactly as scheduled.',
      },
      {
        title: 'Attendance rules',
        content:
          'No grace window — clock-in/clock-out outside the scheduled time is logged as an exception and requires manager approval.',
      },
      {
        title: 'Leave & exceptions',
        content:
          'Public holidays and approved sick leave are excluded automatically; all other absences must be pre-approved before the shift.',
      },
    ],
  },
}

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
  { value: 'rotating_shift', label: 'Rotating shift' },
  { value: 'day_on_day_off', label: 'Day-on / Day-off' },
  { value: 'continental_pattern', label: 'Continental pattern' },
  { value: 'split_shift', label: 'Split shift' },
] satisfies { value: (typeof CYCLE_TYPES)[number]; label: string }[]

export const CYCLE_LENGTH_UNIT_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom_days', label: 'Custom days' },
] satisfies { value: (typeof CYCLE_LENGTH_UNITS)[number]; label: string }[]

export const CYCLE_LENGTH_QUICK_PICKS = [7, 14, 6, 28, 35]

export const ROTATE_TYPE_OPTIONS = [
  { value: 'right_shift', label: 'Right shift' },
  { value: 'normal_rotation', label: 'Normal rotation' },
  { value: 'no_rotation', label: 'No rotation' },
] satisfies { value: (typeof ROTATE_DIRECTIONS)[number]; label: string }[]

export const RECURRENCE_END_TYPE_OPTIONS = [
  { value: 'never', label: 'Never ends' },
  { value: 'after_occurrences', label: 'End after' },
  { value: 'on_date', label: 'End on' },
] satisfies { value: (typeof RECURRENCE_END_TYPES)[number]; label: string }[]
