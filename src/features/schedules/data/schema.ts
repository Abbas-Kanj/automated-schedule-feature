import { z } from 'zod'

export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

const daySchema = z.enum(DAYS_OF_WEEK)

const timeRangeSchema = z
  .object({
    from_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required'),
    to_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required'),
  })
  .refine((val) => val.to_time > val.from_time, {
    message: 'End time must be after start time',
    path: ['to_time'],
  })

const dayScheduleSchema = z.object({
  day: daySchema,
  times: z.array(timeRangeSchema).min(1, 'Add at least one time range'),
})

const employeesSchema = z
  .array(
    z.object({
      value: z.string(),
      label: z.string(),
    })
  )
  .min(1, 'Select at least one employee')

const weeklyScheduleSchema = z.object({
  parent_type: z.literal('daily'),
  type: z.literal('weekly'),
  year: z.number(),
  month: z.number().min(1).max(12),
  week: z.object({
    start_date: z.string(),
    end_date: z.string(),
  }),
  days: z
    .array(dayScheduleSchema)
    .min(1, 'Select at least one day')
    .max(7)
    .refine((days) => new Set(days.map((d) => d.day)).size === days.length, {
      message: 'Each day can only be selected once',
    }),
  employees: employeesSchema,
})

const weeklyOneScheduleSchema = z.object({
  parent_type: z.literal('daily'),
  type: z.literal('weekly_one'),
  days: z
    .array(dayScheduleSchema)
    .min(1, 'Select at least one day')
    .max(7)
    .refine((days) => new Set(days.map((d) => d.day)).size === days.length, {
      message: 'Each day can only be selected once',
    }),
  employees: employeesSchema,
})

const monthlyScheduleSchema = z.object({
  parent_type: z.literal('daily'),
  type: z.literal('monthly'),
  year: z.number(),
  months: z
    .array(
      z.object({
        month: z.number().min(1).max(12),
        days: z
          .array(
            z.object({
              day: z.number().min(1).max(31),
              times: z
                .array(timeRangeSchema)
                .min(1, 'Add at least one time range'),
            })
          )
          .min(1, 'Select at least one day'),
      })
    )
    .min(1, 'Select at least one month')
    .refine(
      (months) => new Set(months.map((m) => m.month)).size === months.length,
      { message: 'Each month can only be selected once' }
    ),
  employees: employeesSchema,
})

const dailyScheduleSchema = z.discriminatedUnion('type', [
  weeklyScheduleSchema,
  weeklyOneScheduleSchema,
  monthlyScheduleSchema,
])

// --- regular schedule: shared basics ---

export const REGULAR_TYPES = ['fixed', 'rotate', 'flexible'] as const

export const BADGE_COLORS = [
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
export const SCHEDULE_ICONS = [
  'briefcase',
  'clock',
  'sun',
  'moon',
  'sunrise',
  'sunset',
  'coffee',
  'building-2',
  'users',
  'calendar',
  'shield',
  'zap',
  'star',
  'flag',
  'home',
  'truck',
] as const
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Required')

// --- fixed / flexible: shift selection ---
//
// `shift_ids` references records in the standalone `shifts` feature's own
// store (`useShiftsStore`, see `src/features/shifts`) rather than duplicating
// a shift's name/badge/icon/days/hours inline here. A schedule fully
// inherits whatever the referenced Shift itself defines — there's no
// per-schedule override of a shift's days or times. To run a shift on
// different days, edit the Shift itself (or pick/create a different one).
const shiftDefinitionFieldsSchema = z.object({
  shift_ids: z
    .array(z.string().min(1))
    .min(1, 'Select or create at least one shift'),
  temporary_schedule: z.boolean().default(false),
  temporary_schedule_label: z.string().max(60).optional(),
})

// --- fixed / flexible: start date + end settings ---

export const RECURRENCE_END_TYPES = [
  'never',
  'after_occurrences',
  'on_date',
] as const
const recurrenceEndTypeSchema = z.enum(RECURRENCE_END_TYPES)

// Just "when does this whole arrangement stop" — never ends / ends after N
// occurrences / ends on a specific date. There's no frequency/weekday
// picker here (that used to live alongside this) since which days a
// schedule runs on now comes entirely from its selected shifts' own days.
const endSettingsSchema = z
  .object({
    end_type: recurrenceEndTypeSchema,
    end_occurrences: z.number().min(1).optional(),
    end_date: dateStringSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.end_type === 'after_occurrences' && val.end_occurrences == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Set the number of occurrences',
        path: ['end_occurrences'],
      })
    }

    if (val.end_type === 'on_date' && !val.end_date) {
      ctx.addIssue({
        code: 'custom',
        message: 'Set the end date',
        path: ['end_date'],
      })
    }
  })

// step 3 (fixed/flexible only) — rotate covers its own start date +
// repetition through its cycle/pattern config instead
const regularSharedSchema = z.object({
  start_date: dateStringSchema,
  end_settings: endSettingsSchema,
})

// --- rotate: cycle / pattern config ---

// "Pattern shifts" builds the cycle day-by-day (a shift or day-off picked
// per position, see `rotatePatternEntrySchema`). "Custom shifts" starts
// from how many times each selected shift repeats (`customShiftCountSchema`)
// and uses that to seed the same per-day pattern, which stays editable
// afterward — both modes end up driving the same `pattern` array.
export const CYCLE_TYPES = ['pattern_shifts', 'custom_shifts'] as const
const cycleTypeSchema = z.enum(CYCLE_TYPES)

export const CYCLE_LENGTH_UNITS = ['weekly', 'monthly', 'custom_days'] as const
const cycleLengthSchema = z.object({
  unit: z.enum(CYCLE_LENGTH_UNITS),
  days: z.number().min(1),
})

// A pattern day now points at one of the schedule's own selected shifts
// (`shift_id`, resolved against `shift_ids`/the `shifts` store) instead of a
// hand-authored "block" — rotate's step 1/2 match fixed/flexible's exactly
// (see `shiftDefinitionFieldsSchema`), so there's no separate block concept
// left to reference.
const rotatePatternEntrySchema = z.object({
  position: z.number().min(1),
  shift_id: z.string().optional(),
  is_off: z.boolean(),
})

// "Custom shifts" mode: one count per selected shift ("how many days in the
// cycle it covers"), kept in `shift_ids` order — see the "Apply to days"
// action in `pattern-builder.tsx` that seeds `pattern` from these counts.
const customShiftCountSchema = z.object({
  shift_id: z.string(),
  count: z.number().min(0),
})

const rotateFieldsSchema = z.object({
  cycle_type: cycleTypeSchema,
  cycle_length: cycleLengthSchema,
  shift_length_hours: z.number().min(1).max(24),
  pattern: z.array(rotatePatternEntrySchema).min(1),
  custom_shift_counts: z.array(customShiftCountSchema).default([]),
})

// --- assemble the three `regular` arms ---

const regularFixedSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('fixed'),
  ...regularSharedSchema.shape,
  ...shiftDefinitionFieldsSchema.shape,
})

const regularFlexibleSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('flexible'),
  ...regularSharedSchema.shape,
  ...shiftDefinitionFieldsSchema.shape,
})

// rotate's step 1/2 are the same `ScheduleBasicsFields`/`ShiftPickerField`
// fixed and flexible use — it only diverges from them at step 3 (its own
// cycle/pattern config, in place of fixed/flexible's `end_settings`), so it
// shares `shiftDefinitionFieldsSchema` too rather than a rotate-only shape.
const regularRotateSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('rotate'),
  start_date: dateStringSchema,
  ...shiftDefinitionFieldsSchema.shape,
  ...rotateFieldsSchema.shape,
})

const regularScheduleSchema = z
  .discriminatedUnion('type', [
    regularFixedSchema,
    regularFlexibleSchema,
    regularRotateSchema,
  ])
  .superRefine((val, ctx) => {
    if (new Set(val.shift_ids).size !== val.shift_ids.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Each shift can only be selected once',
        path: ['shift_ids'],
      })
    }

    // A rotation needs at least 2 distinct shifts to alternate between —
    // fixed/flexible are fine with just one (see `shiftDefinitionFieldsSchema`).
    if (val.type === 'rotate' && val.shift_ids.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least 2 shifts to build a rotation',
        path: ['shift_ids'],
      })
    }

    if (val.type === 'rotate') {
      if (val.pattern.length !== val.cycle_length.days) {
        ctx.addIssue({
          code: 'custom',
          message: `Assign all ${val.cycle_length.days} day(s) of the cycle`,
          path: ['pattern'],
        })
      }

      const positions = val.pattern.map((p) => p.position)
      if (new Set(positions).size !== positions.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Each cycle day can only appear once',
          path: ['pattern'],
        })
      }

      val.pattern.forEach((p, i) => {
        if (!p.is_off && !p.shift_id) {
          ctx.addIssue({
            code: 'custom',
            message: 'Select a shift or mark as day off',
            path: ['pattern', i, 'shift_id'],
          })
        }
      })

      if (val.cycle_type === 'custom_shifts') {
        const totalCount = val.custom_shift_counts.reduce(
          (sum, c) => sum + c.count,
          0
        )
        if (totalCount > val.cycle_length.days) {
          ctx.addIssue({
            code: 'custom',
            message: `Shift counts add up to more than the ${val.cycle_length.days}-day cycle`,
            path: ['custom_shift_counts'],
          })
        }
      }
    }
  })

const commonScheduleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  // Predefined-template picker on step 1 — wiring templates to actually
  // pre-fill a schedule is a follow-up; for now this just records the pick.
  template_id: z.string().optional(),
})

export const scheduleSchema = z
  .discriminatedUnion('parent_type', [
    dailyScheduleSchema,
    regularScheduleSchema,
  ])
  .and(commonScheduleSchema)

export type Schedule = z.infer<typeof scheduleSchema>
export type ParentScheduleType = Schedule['parent_type']
export type DailySchedule = Extract<Schedule, { parent_type: 'daily' }>
export type RegularSchedule = Extract<Schedule, { parent_type: 'regular' }>
export type ScheduleType = DailySchedule['type']
export type RegularScheduleType = RegularSchedule['type']
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]
export type TimeRange = z.infer<typeof timeRangeSchema>
export type DaySchedule = z.infer<typeof dayScheduleSchema>
export type RegularType = (typeof REGULAR_TYPES)[number]
export type BadgeColor = (typeof BADGE_COLORS)[number]
export type ScheduleIcon = (typeof SCHEDULE_ICONS)[number]
export type EndSettings = z.infer<typeof endSettingsSchema>
export type RecurrenceEndType = (typeof RECURRENCE_END_TYPES)[number]
export type CycleType = (typeof CYCLE_TYPES)[number]
export type CycleLengthUnit = (typeof CYCLE_LENGTH_UNITS)[number]
export type RotatePatternEntry = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['pattern'][number]
export type CustomShiftCount = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['custom_shift_counts'][number]
