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
import {
  type BREAK_TYPES,
  type DAYS_OF_WEEK,
  type REPEAT_END_TYPES,
  type REPEAT_FREQUENCIES,
  type REPEAT_MONTHLY_MODES,
  SHIFT_BADGE_COLORS,
  type SHIFT_CATEGORIES,
  SHIFT_ICONS,
  type SHIFT_POLICY_TYPES,
  type SHIFT_STATUSES,
  type SHIFT_TIME_SLOT_TYPES,
  type SHIFT_TYPES,
  type ShiftPolicyType,
} from './schema'

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

export const SHIFT_TYPE_OPTIONS: {
  value: (typeof SHIFT_TYPES)[number]
  label: string
  description: string
}[] = [
  {
    value: 'fixed',
    label: 'Fixed shift',
    description: 'Same time range every day it runs.',
  },
  {
    value: 'rotate',
    label: 'Rotate shift',
    description: 'Rotates across a recurring pattern.',
  },
  {
    value: 'split',
    label: 'Split shift',
    description: 'Runs in separate blocks within a day.',
  },
]

export const SHIFT_CATEGORY_OPTIONS: {
  value: (typeof SHIFT_CATEGORIES)[number]
  label: string
}[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'regular', label: 'Regular' },
  { value: 'night', label: 'Night' },
  { value: 'oncall', label: 'On-call' },
  { value: 'remotely', label: 'Remotely' },
  { value: 'custom', label: 'Custom' },
]

export const SHIFT_STATUS_OPTIONS: {
  value: (typeof SHIFT_STATUSES)[number]
  label: string
}[] = [
  { value: 'tentative', label: 'Tentative' },
  { value: 'published', label: 'Published' },
  { value: 'confirmed', label: 'Confirmed' },
]

export const SHIFT_TIME_SLOT_TYPE_OPTIONS: {
  value: (typeof SHIFT_TIME_SLOT_TYPES)[number]
  label: string
}[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'overtime', label: 'Overtime' },
]

// Mirrors `schedules`' POLICY_TYPE_OPTIONS/POLICY_DETAILS — its own copy
// since `shifts` is a standalone feature (see CLAUDE.md).
export const SHIFT_POLICY_TYPE_OPTIONS = (
  ['standard', 'flexible', 'strict'] satisfies (typeof SHIFT_POLICY_TYPES)[number][]
).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

export type ShiftPolicyDetail = {
  summary: string
  sections: { title: string; content: string }[]
}

export const SHIFT_POLICY_DETAILS: Record<ShiftPolicyType, ShiftPolicyDetail> = {
  standard: {
    summary: 'Default working hours and leave rules for most shifts.',
    sections: [
      {
        title: 'Overview',
        content:
          'Applies the organization’s default working-hours and leave rules. Best suited for shifts that don’t need a custom arrangement.',
      },
      {
        title: 'Attendance rules',
        content:
          'Clock-in/clock-out is expected within a 15-minute grace window of the shift time. Repeated late arrivals are flagged for manager review.',
      },
      {
        title: 'Leave & exceptions',
        content:
          'Standard annual/sick leave accrual applies. Public holidays and approved sick leave are automatically excluded from the shift.',
      },
    ],
  },
  flexible: {
    summary: 'Allows flexible start/end times within core working hours.',
    sections: [
      {
        title: 'Overview',
        content:
          'Employees can shift their start and end times as long as they cover the defined core hours and meet their total shift length.',
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
          'Used for shifts with hard coverage requirements (e.g. front desk, security). Times are enforced exactly as scheduled.',
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

export const REPEAT_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] satisfies { value: (typeof REPEAT_FREQUENCIES)[number]; label: string }[]

export const REPEAT_END_TYPE_OPTIONS = [
  { value: 'never', label: 'Never ends' },
  { value: 'after_occurrences', label: 'End after' },
  { value: 'on_date', label: 'End on' },
] satisfies { value: (typeof REPEAT_END_TYPES)[number]; label: string }[]

export const REPEAT_MONTHLY_MODE_OPTIONS = [
  { value: 'day_month', label: 'Day of month' },
  { value: 'date_specific', label: 'Date specific' },
  { value: 'day_position', label: 'Day position' },
] satisfies { value: (typeof REPEAT_MONTHLY_MODES)[number]; label: string }[]

export const BREAK_TYPE_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
] satisfies { value: (typeof BREAK_TYPES)[number]; label: string }[]

// "Additional info" tab dropdowns. There's no backend yet (see CLAUDE.md),
// so these are representative placeholder options rather than live data.
export const WORK_TYPE_GROUP_OPTIONS = [
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
]

export const SERVICE_RESOURCE_OPTIONS = [
  { value: 'alex-johnson', label: 'Alex Johnson' },
  { value: 'sam-lee', label: 'Sam Lee' },
  { value: 'jordan-blake', label: 'Jordan Blake' },
  { value: 'taylor-kim', label: 'Taylor Kim' },
]

export const SERVICE_TERRITORY_OPTIONS = [
  { value: 'north-region', label: 'North region' },
  { value: 'south-region', label: 'South region' },
  { value: 'east-region', label: 'East region' },
  { value: 'west-region', label: 'West region' },
]

export const DAY_LABELS: Record<(typeof DAYS_OF_WEEK)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

// The IANA time zone the browser is currently running in — used for the
// "Local" radio option in the timezone field.
export const LOCAL_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone

// The "Global" radio option's dropdown. `Intl.supportedValuesOf` covers
// every modern evergreen browser target this app ships to, but the
// project's `lib` target (ES2020) predates its type declaration — cast
// narrowly instead of widening `lib` for one API. Falls back to a short
// common list for anything older.
const supportedValuesOf = (
  Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => string[] }
).supportedValuesOf

export const GLOBAL_TIMEZONES: string[] =
  typeof supportedValuesOf === 'function'
    ? supportedValuesOf('timeZone')
    : [
        'UTC',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Dubai',
        'Asia/Kolkata',
        'Asia/Singapore',
        'Asia/Tokyo',
        'Australia/Sydney',
      ]
