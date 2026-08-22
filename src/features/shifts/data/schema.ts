import { z } from 'zod'
import { toMinutes } from '@/lib/time'

export const SHIFT_BADGE_COLORS = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
] as const
const shiftBadgeColorSchema = z.enum(SHIFT_BADGE_COLORS)

export const SHIFT_ICONS = [
  'briefcase',
  'clock',
  'sun',
  'moon',
  'sunrise',
  'sunset',
  'coffee',
  'zap',
  'calendar',
  'users',
  'shield',
  'star',
] as const
const shiftIconSchema = z.enum(SHIFT_ICONS)

export const SHIFT_TYPES = ['fixed', 'rotate', 'split'] as const
const shiftTypeSchema = z.enum(SHIFT_TYPES)

export const SHIFT_CATEGORIES = [
  'morning',
  'overnight',
  'afternoon',
  'regular',
  'night',
  'oncall',
  'remotely',
  'custom',
] as const
const shiftCategorySchema = z.enum(SHIFT_CATEGORIES)

export const SHIFT_TIMEZONE_MODES = ['local', 'global'] as const
const shiftTimezoneModeSchema = z.enum(SHIFT_TIMEZONE_MODES)

export const SHIFT_HOURS_MODES = ['same', 'different'] as const
const shiftHoursModeSchema = z.enum(SHIFT_HOURS_MODES)

export const SHIFT_STATUSES = ['tentative', 'published', 'confirmed'] as const
const shiftStatusSchema = z.enum(SHIFT_STATUSES)

export const SHIFT_TIME_SLOT_TYPES = ['regular', 'overtime'] as const
const shiftTimeSlotTypeSchema = z.enum(SHIFT_TIME_SLOT_TYPES)

// "Repeat" tab — mirrors the shape of `schedules`' recurrence
// fields (see `schedules/data/schema.ts`), kept as its own copy since
// `shifts` is a standalone feature.
export const REPEAT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
const repeatFrequencySchema = z.enum(REPEAT_FREQUENCIES)

export const REPEAT_END_TYPES = ['never', 'on_date', 'after_occurrences'] as const
const repeatEndTypeSchema = z.enum(REPEAT_END_TYPES)

// Monthly's 3 sub-modes (see the "Case Monthly" wireframe): a single
// day-of-month, two specific day-of-month picks, or an "nth weekday of the
// month" pattern (e.g. "the 2nd Tuesday").
export const REPEAT_MONTHLY_MODES = [
  'day_month',
  'date_specific',
  'day_position',
] as const
const repeatMonthlyModeSchema = z.enum(REPEAT_MONTHLY_MODES)

// Break-time list, a standalone field on the "Shift times" tab (see
// `shift-form/shift-times-tab.tsx`).
export const BREAK_TYPES = ['paid', 'unpaid'] as const
const breakTypeSchema = z.enum(BREAK_TYPES)

export const DAYS_OF_WEEK = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const
const dayOfWeekSchema = z.enum(DAYS_OF_WEEK)

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required')

// One contiguous time range within a day. Lets the range cross midnight
// (e.g. 22:00 -> 06:00) instead of failing the "end after start" check
// below — see the `dayTimesCollide` refine on `dayTimeEntrySchema`.
const timeRangeEntrySchema = z.object({
  from_time: timeStringSchema,
  to_time: timeStringSchema,
  overnight: z.boolean().default(false),
})

// Unwraps a range onto a continuous timeline (adding a day once it crosses
// midnight) so two ranges on the same day can be compared for overlap with
// plain start/end math. Mirrors `schedules`' `getShiftTimeEntryRange`. Only
// the clock actually wrapping matters here, not the `overnight` flag on its
// own — a range whose `overnight` is set but that already ends after it
// starts (09:00 -> 17:00) doesn't span an extra day (see `ShiftTimesTab`'s
// "Overnight" category handling, which forces that flag on regardless of
// the times actually chosen).
function getTimeRangeSpan(entry: { from_time: string; to_time: string }) {
  const start = toMinutes(entry.from_time)
  let end = toMinutes(entry.to_time)
  if (end <= start) end += 24 * 60
  return { start, end }
}

// True if any two ranges in the list overlap. Mirrors `schedules`'
// `shiftTimesCollide`.
export function dayTimesCollide(
  times: { from_time: string; to_time: string; overnight?: boolean }[]
): boolean {
  const ranges = times.map(getTimeRangeSpan)
  return ranges.some((a, i) =>
    ranges.some((b, j) => j !== i && a.start < b.end && b.start < a.end)
  )
}

// One row of the weekly hours grid (see `shift-form/shift-hours-field.tsx`).
// `enabled` is whether the shift runs that day at all; `times` holds one or
// more non-colliding ranges for that day, only meaningful when it is.
const dayTimeEntrySchema = z.object({
  day: dayOfWeekSchema,
  enabled: z.boolean(),
  times: z.array(timeRangeEntrySchema).default([]),
})

// The single "nth weekday of the month" rule for the Day-Position monthly
// sub-mode, e.g. { position: 2, weekday: 'tue' } = "the 2nd Tuesday".
const repeatDayPositionRuleSchema = z.object({
  position: z.number().min(1).max(28),
  weekday: dayOfWeekSchema,
})

// The "Repeat" tab's config, only meaningful once its "Repeat" toggle
// (`repeat_enabled`) is on — see `shift-form/repeat-fields.tsx`.
const repeatConfigSchema = z.object({
  frequency: repeatFrequencySchema.optional(),
  interval: z.number().min(1).optional(),
  weekdays: z.array(dayOfWeekSchema).optional(),
  // Monthly only — which of the 3 sub-modes below is active.
  monthly_mode: repeatMonthlyModeSchema.optional(),
  // monthly_mode === 'day_month'
  day_of_month: z.number().min(1).max(28).optional(),
  // monthly_mode === 'date_specific'
  date_specific_1: z.number().min(1).max(28).optional(),
  date_specific_2: z.number().min(1).max(28).optional(),
  // monthly_mode === 'day_position'
  day_position_rules: z.array(repeatDayPositionRuleSchema).max(1).optional(),
  end_type: repeatEndTypeSchema.optional(),
  end_date: z.string().optional(),
  end_occurrences: z.number().min(1).optional(),
})

// One row of the break-time list. `break_type` is per-break — each break
// created on a shift can be paid or unpaid independently of the others
// (there's no shift-wide setting). `duration_minutes` is user-entered (not
// picked from a preset list) and bounded by this entry's own
// from_time–to_time span (see the `duration_minutes` check below) — only
// meaningful for paid breaks, an unpaid break just treats its whole
// from/to span as the break. `name`/`icon` are just a label — no
// downstream validation of their own. `icon` reuses the shift-level icon
// enum rather than a parallel one.
const breakEntrySchema = z.object({
  break_type: breakTypeSchema.optional(),
  from_time: timeStringSchema,
  to_time: timeStringSchema,
  duration_minutes: z.number().min(1).optional(),
  name: z.string().max(40).optional(),
  icon: shiftIconSchema.optional(),
})

// Shared shape for both the stored `Shift` record and the create/edit form
// (which fills in `id` separately — see `shifts/utils.ts#generateId`).
const shiftFieldsSchema = z
  .object({
    name: z.string().min(1, 'Shift name is required'),
    short_code: z.string().min(1, 'Required').max(6),
    badge_color: shiftBadgeColorSchema,
    icon: shiftIconSchema,
    shift_type: shiftTypeSchema,
    category: shiftCategorySchema,
    // Only used (and required) when category === 'custom'.
    custom_category: z.string().max(40).optional(),
    timezone_mode: shiftTimezoneModeSchema,
    // Only used (and required) when timezone_mode === 'global'; an IANA
    // time zone id, e.g. "Europe/Berlin".
    timezone: z.string().optional(),
    // 'same' copies one time range to every enabled day; 'different' lets
    // each day carry its own range. See `shift-form/shift-times-tab.tsx`.
    hours_mode: shiftHoursModeSchema,
    days: z.array(dayTimeEntrySchema).length(7, 'All 7 days are required'),
    // "Shift times" tab — how long a full/half day of work counts for, in
    // hours. Both optional: a shift is still valid without them, and
    // neither feeds any other validation today.
    full_day_hours: z.number().min(0).max(24).optional(),
    half_day_hours: z.number().min(0).max(24).optional(),
    // Break-time toggle, a field on the "Shift times" tab — off by
    // default, `breaks` is only validated once it's on. Paid/unpaid is set
    // per break entry (see `breakEntrySchema.break_type`), not shift-wide.
    break_enabled: z.boolean().default(false),
    breaks: z.array(breakEntrySchema).default([]),
    description: z.string().max(200).optional(),
    is_active: z.boolean().default(true),
    // Shift policies attached to this shift, by id — the records the
    // "Shift policy" tab and the table's policy drawer search, attach and
    // create (see `features/shift-policies`). Optional by design: a shift
    // definition is useful without one, so we don't force a pick.
    policy_ids: z.array(z.string()).default([]),
    status: shiftStatusSchema,
    time_slot_type: shiftTimeSlotTypeSchema,
    // "Repeat" tab's toggle — off by default, `repeat` is only validated
    // once it's on.
    repeat_enabled: z.boolean().default(false),
    repeat: repeatConfigSchema,
    // "Assign to" tab's toggle — off by default. Doesn't gate any of its
    // own validation (the picks below have none of their own either), just
    // enables/disables the fields it sits above in the UI.
    assign_to_enabled: z.boolean().default(false),
    // "Assign to" tab — all optional, freeform picks with no downstream
    // validation of their own. `work_type_group` is multi-select (a shift
    // can span more than one work type), the other two stay single-select.
    work_type_group: z.array(z.string()).optional(),
    service_resource: z.string().optional(),
    service_territory: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.category === 'custom' && !val.custom_category?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a name for the custom category',
        path: ['custom_category'],
      })
    }
    if (val.timezone_mode === 'global' && !val.timezone) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a time zone',
        path: ['timezone'],
      })
    }
    if (!val.days.some((d) => d.enabled)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least one day',
        path: ['days'],
      })
    }
    val.days.forEach((d, index) => {
      if (!d.enabled) return
      if (!d.times.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Add at least one time range',
          path: ['days', index, 'times'],
        })
        return
      }
      d.times.forEach((t, timeIndex) => {
        if (!t.overnight && !(t.to_time > t.from_time)) {
          ctx.addIssue({
            code: 'custom',
            message: 'End time must be after start time (or mark as overnight)',
            path: ['days', index, 'times', timeIndex, 'to_time'],
          })
        }
      })
      if (dayTimesCollide(d.times)) {
        ctx.addIssue({
          code: 'custom',
          message: "Times can't overlap — adjust them so they don't collide",
          path: ['days', index, 'times'],
        })
      }
    })
    if (val.break_enabled) {
      if (!val.breaks.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Add at least one break',
          path: ['breaks'],
        })
      }
      val.breaks.forEach((b, index) => {
        if (!b.break_type) {
          ctx.addIssue({
            code: 'custom',
            message: 'Select a break type',
            path: ['breaks', index, 'break_type'],
          })
        }
        if (!(b.to_time > b.from_time)) {
          ctx.addIssue({
            code: 'custom',
            message: 'End time must be after start time',
            path: ['breaks', index, 'to_time'],
          })
          return
        }
        // Duration defaults on creation (see `DEFAULT_BREAK` in
        // `shift-times-tab.tsx`) and is edited via an "H:MM" input rather
        // than typed in from scratch, so it's not required the way the
        // break type is — only bounded once one is entered.
        if (
          b.break_type === 'paid' &&
          b.duration_minutes &&
          b.duration_minutes > toMinutes(b.to_time) - toMinutes(b.from_time)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: "Duration can't be longer than the from–to range",
            path: ['breaks', index, 'duration_minutes'],
          })
        }
      })
    }
    if (val.repeat_enabled) {
      if (!val.repeat.frequency) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select a repeat frequency',
          path: ['repeat', 'frequency'],
        })
      }
      if (!val.repeat.interval) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter how often it repeats',
          path: ['repeat', 'interval'],
        })
      }
      // "Days" (daily) is interval-only — no weekday picker, so nothing to
      // require here. Weekly allows any number of selected days (see the
      // shared `@/components/recurrence-frequency-fields`), just at least
      // one.
      if (val.repeat.frequency === 'weekly' && !val.repeat.weekdays?.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select at least one day',
          path: ['repeat', 'weekdays'],
        })
      }
      if (val.repeat.frequency === 'monthly') {
        if (!val.repeat.monthly_mode) {
          ctx.addIssue({
            code: 'custom',
            message: 'Select how it repeats monthly',
            path: ['repeat', 'monthly_mode'],
          })
        } else if (
          val.repeat.monthly_mode === 'day_month' &&
          !val.repeat.day_of_month
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Enter a day of the month',
            path: ['repeat', 'day_of_month'],
          })
        } else if (val.repeat.monthly_mode === 'date_specific') {
          if (!val.repeat.date_specific_1) {
            ctx.addIssue({
              code: 'custom',
              message: 'Enter a date',
              path: ['repeat', 'date_specific_1'],
            })
          }
          if (!val.repeat.date_specific_2) {
            ctx.addIssue({
              code: 'custom',
              message: 'Enter a date',
              path: ['repeat', 'date_specific_2'],
            })
          }
        } else if (
          val.repeat.monthly_mode === 'day_position' &&
          !val.repeat.day_position_rules?.length
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Add at least one rule',
            path: ['repeat', 'day_position_rules'],
          })
        }
      }
      if (!val.repeat.end_type) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select when it ends',
          path: ['repeat', 'end_type'],
        })
      }
      if (val.repeat.end_type === 'on_date' && !val.repeat.end_date) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select an end date',
          path: ['repeat', 'end_date'],
        })
      }
      if (val.repeat.end_type === 'after_occurrences' && !val.repeat.end_occurrences) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter a number of occurrences',
          path: ['repeat', 'end_occurrences'],
        })
      }
    }
  })

export const shiftFormSchema = shiftFieldsSchema
export const shiftSchema = z.object({ id: z.string() }).and(shiftFieldsSchema)

export type Shift = z.infer<typeof shiftSchema>
export type ShiftFormValues = z.infer<typeof shiftFormSchema>
export type ShiftBadgeColor = (typeof SHIFT_BADGE_COLORS)[number]
export type ShiftIcon = (typeof SHIFT_ICONS)[number]
export type ShiftType = (typeof SHIFT_TYPES)[number]
export type ShiftCategory = (typeof SHIFT_CATEGORIES)[number]
export type ShiftTimezoneMode = (typeof SHIFT_TIMEZONE_MODES)[number]
export type ShiftHoursMode = (typeof SHIFT_HOURS_MODES)[number]
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]
export type DayTimeEntry = z.infer<typeof dayTimeEntrySchema>
export type TimeRangeEntry = z.infer<typeof timeRangeEntrySchema>
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]
export type ShiftTimeSlotType = (typeof SHIFT_TIME_SLOT_TYPES)[number]
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number]
export type RepeatEndType = (typeof REPEAT_END_TYPES)[number]
export type RepeatMonthlyMode = (typeof REPEAT_MONTHLY_MODES)[number]
export type RepeatDayPositionRule = z.infer<typeof repeatDayPositionRuleSchema>
export type RepeatConfig = z.infer<typeof repeatConfigSchema>
export type BreakType = (typeof BREAK_TYPES)[number]
export type BreakEntry = z.infer<typeof breakEntrySchema>
