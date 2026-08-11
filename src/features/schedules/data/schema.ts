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

export const POLICY_TYPES = ['standard', 'flexible', 'strict'] as const

const policyTypeSchema = z.enum(POLICY_TYPES)

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
const badgeColorSchema = z.enum(BADGE_COLORS)

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
const scheduleIconSchema = z.enum(SCHEDULE_ICONS)

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Required')

const regularBaseSchema = z.object({
  is_active: z.boolean().default(true),
  policy_type: policyTypeSchema,
  start_date: dateStringSchema,
})

// --- fixed / flexible: shift definition ---

const regularShiftDaySchema = z.object({
  day: daySchema,
  time: timeRangeSchema,
})

const regularShiftSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Shift name is required'),
  short_code: z.string().min(1, 'Required').max(6),
  badge_color: badgeColorSchema,
  icon: scheduleIconSchema,
  shift_length_hours: z.number().min(1).max(24),
  overnight: z.boolean().optional(),
  days: z
    .array(regularShiftDaySchema)
    .min(1, 'Assign at least one day')
    .refine((days) => new Set(days.map((d) => d.day)).size === days.length, {
      message: 'Each day can only be selected once',
    }),
})

const shiftDefinitionFieldsSchema = z.object({
  nb_of_shifts: z.number().min(1),
  shifts: z.array(regularShiftSchema),
  temporary_schedule: z.boolean().default(false),
  temporary_schedule_label: z.string().max(60).optional(),
})

// --- occurrence / recurrence rule ---

export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
const recurrenceFrequencySchema = z.enum(RECURRENCE_FREQUENCIES)

export const RECURRENCE_END_TYPES = [
  'never',
  'after_occurrences',
  'on_date',
] as const
const recurrenceEndTypeSchema = z.enum(RECURRENCE_END_TYPES)

const recurrenceSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    interval: z.number().min(1),
    weekdays: z.array(daySchema).optional(),
    day_of_month_from: z.number().min(1).max(28).optional(),
    day_of_month_to: z.number().min(1).max(28).optional(),
    end_type: recurrenceEndTypeSchema,
    end_occurrences: z.number().min(1).optional(),
    end_date: dateStringSchema.optional(),
    exceptions: z.object({
      public_holiday: z.boolean().default(false),
      sick_leave: z.boolean().default(false),
    }),
  })
  .superRefine((val, ctx) => {
    if (
      (val.frequency === 'daily' || val.frequency === 'weekly') &&
      !val.weekdays?.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least one day',
        path: ['weekdays'],
      })
    }

    if (val.frequency === 'monthly') {
      if (val.day_of_month_from == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Set the start day of month',
          path: ['day_of_month_from'],
        })
      }
      if (val.day_of_month_to == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Set the end day of month',
          path: ['day_of_month_to'],
        })
      }
      if (
        val.day_of_month_from != null &&
        val.day_of_month_to != null &&
        val.day_of_month_to < val.day_of_month_from
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'End day must be on or after start day',
          path: ['day_of_month_to'],
        })
      }
    }

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

// occurrence (step 4) only applies to fixed/flexible schedules — rotate
// covers repetition through its cycle/pattern config instead
const regularSharedSchema = regularBaseSchema.extend({
  recurrence: recurrenceSchema,
})

// --- rotate: cycle / pattern config ---

export const CYCLE_TYPES = [
  'rotating_shift',
  'day_on_day_off',
  'continental_pattern',
  'split_shift',
] as const
const cycleTypeSchema = z.enum(CYCLE_TYPES)

export const CYCLE_LENGTH_UNITS = ['weekly', 'monthly', 'custom_days'] as const
const cycleLengthSchema = z.object({
  unit: z.enum(CYCLE_LENGTH_UNITS),
  days: z.number().min(1),
})

export const ROTATE_DIRECTIONS = [
  'right_shift',
  'normal_rotation',
  'no_rotation',
] as const
const rotateTypeSchema = z.enum(ROTATE_DIRECTIONS)

const rotateBlockSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Label is required'),
  time: timeRangeSchema,
})

const rotatePatternEntrySchema = z.object({
  position: z.number().min(1),
  block_id: z.string().optional(),
  is_off: z.boolean(),
})

const rotateFieldsSchema = z.object({
  cycle_type: cycleTypeSchema,
  cycle_length: cycleLengthSchema,
  rotate_type: rotateTypeSchema,
  shift_block: z.number().min(1),
  shift_length_hours: z.number().min(1).max(24),
  blocks: z.array(rotateBlockSchema),
  pattern: z.array(rotatePatternEntrySchema).min(1),
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

const regularRotateSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('rotate'),
  ...regularBaseSchema.shape,
  ...rotateFieldsSchema.shape,
})

const regularScheduleSchema = z
  .discriminatedUnion('type', [
    regularFixedSchema,
    regularFlexibleSchema,
    regularRotateSchema,
  ])
  .superRefine((val, ctx) => {
    if (val.type === 'fixed' || val.type === 'flexible') {
      if (val.shifts.length !== val.nb_of_shifts) {
        ctx.addIssue({
          code: 'custom',
          message: `Configure all ${val.nb_of_shifts} shift(s)`,
          path: ['shifts'],
        })
      }
    }

    if (val.type === 'rotate') {
      if (val.blocks.length !== val.shift_block) {
        ctx.addIssue({
          code: 'custom',
          message: `Configure all ${val.shift_block} shift block(s)`,
          path: ['blocks'],
        })
      }

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
        if (!p.is_off && !p.block_id) {
          ctx.addIssue({
            code: 'custom',
            message: 'Select a shift or mark as day off',
            path: ['pattern', i, 'block_id'],
          })
        }
      })
    }
  })

const commonScheduleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
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
export type PolicyType = z.infer<typeof policyTypeSchema>
export type RegularType = (typeof REGULAR_TYPES)[number]
export type BadgeColor = (typeof BADGE_COLORS)[number]
export type ScheduleIcon = (typeof SCHEDULE_ICONS)[number]
export type RegularShift = Extract<
  RegularSchedule,
  { type: 'fixed' | 'flexible' }
>['shifts'][number]
export type RegularShiftDay = RegularShift['days'][number]
export type Recurrence = z.infer<typeof recurrenceSchema>
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]
export type RecurrenceEndType = (typeof RECURRENCE_END_TYPES)[number]
export type CycleType = (typeof CYCLE_TYPES)[number]
export type CycleLengthUnit = (typeof CYCLE_LENGTH_UNITS)[number]
export type RotateType = (typeof ROTATE_DIRECTIONS)[number]
export type RotateBlock = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['blocks'][number]
export type RotatePatternEntry = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['pattern'][number]
