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

function rangeHours(range: { from_time: string; to_time: string }) {
  const [fromH, fromM] = range.from_time.split(':').map(Number)
  const [toH, toM] = range.to_time.split(':').map(Number)
  return (toH * 60 + toM - (fromH * 60 + fromM)) / 60
}

const dayScheduleSchema = z.object({
  day: daySchema,
  times: z.array(timeRangeSchema).min(1, 'Add at least one time range'),
})

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
})

const dailyScheduleSchema = z.discriminatedUnion('type', [
  weeklyScheduleSchema,
  weeklyOneScheduleSchema,
  monthlyScheduleSchema,
])

const singleShiftSchema = z
  .object({
    days: z.array(daySchema).min(1, 'Select at least one day'),
    time: timeRangeSchema,
    has_break: z.boolean(),
    break_time: timeRangeSchema.optional(),
    break_hours: z.number().min(0.25).optional(),
  })
  .refine((val) => !val.has_break || !!val.break_time, {
    message: 'Add a break time range',
    path: ['break_time'],
  })
  .refine(
    (val) =>
      !val.has_break ||
      !val.break_time ||
      (val.break_time.from_time >= val.time.from_time &&
        val.break_time.to_time <= val.time.to_time),
    {
      message: 'Break must be within the shift time',
      path: ['break_time'],
    }
  )
  .refine((val) => !val.has_break || val.break_hours != null, {
    message: 'Set break hours',
    path: ['break_hours'],
  })
  .refine(
    (val) =>
      !val.has_break ||
      val.break_hours == null ||
      !val.break_time ||
      val.break_hours <= rangeHours(val.break_time),
    {
      message: 'Break hours must not exceed the break time range',
      path: ['break_hours'],
    }
  )

const regularShiftDaySchema = z.object({
  day: daySchema,
  splits: z.array(timeRangeSchema).min(1, 'Add at least one time range'),
})

const regularShiftSchema = z
  .object({
    days: z
      .array(regularShiftDaySchema)
      .refine(
        (days) => new Set(days.map((d) => d.day)).size === days.length,
        { message: 'Each day can only be selected once' }
      ),
    has_break: z.boolean(),
    break_time: timeRangeSchema.optional(),
    break_hours: z.number().min(1).max(12).optional(),
  })
  .refine((val) => !val.has_break || !!val.break_time, {
    message: 'Add a break time range',
    path: ['break_time'],
  })
  .refine((val) => !val.has_break || val.break_hours != null, {
    message: 'Set break hours',
    path: ['break_hours'],
  })
  .refine(
    (val) =>
      !val.has_break ||
      val.break_hours == null ||
      !val.break_time ||
      val.break_hours <= rangeHours(val.break_time),
    {
      message: 'Break hours must not exceed the break time range',
      path: ['break_hours'],
    }
  )

export const SHIFT_CYCLES = ['weekly', 'alternative'] as const
const shiftCycleSchema = z.enum(SHIFT_CYCLES)

export const SHIFT_ROTATIONS = [
  'right_shift',
  'normal_rotation',
  'no_rotation',
] as const
const shiftRotationSchema = z.enum(SHIFT_ROTATIONS)

export const SHIFT_ROTATIONS_BY_CYCLE: Record<
  (typeof SHIFT_CYCLES)[number],
  readonly (typeof SHIFT_ROTATIONS)[number][]
> = {
  weekly: ['right_shift', 'normal_rotation'],
  alternative: ['right_shift', 'no_rotation'],
}

const regularScheduleSchema = z
  .object({
    parent_type: z.literal('regular'),
    shift_number: z.number().min(1),
    split_number: z.number().min(1),
    single_shift: singleShiftSchema.optional(),
    shifts: z.array(regularShiftSchema).optional(),
    shift_cycle: shiftCycleSchema.optional(),
    shift_rotation: shiftRotationSchema.optional(),
    repeated_shift: z.number().min(1).max(3).optional(),
    leave_hours: z.number().min(1).max(12).optional(),
    official_holiday_hours: z.number().min(1).max(12).optional(),
    policy_type: policyTypeSchema.optional(),
  })
  .superRefine((val, ctx) => {
    const isSingle = val.shift_number === 1 && val.split_number === 1

    if (!val.policy_type) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a policy type',
        path: ['policy_type'],
      })
    }

    if (isSingle) {
      if (!val.single_shift) {
        ctx.addIssue({
          code: 'custom',
          message: 'Set the shift time',
          path: ['single_shift'],
        })
      }
      return
    }

    if (!val.shifts || val.shifts.length !== val.shift_number) {
      ctx.addIssue({
        code: 'custom',
        message: `Configure all ${val.shift_number} shift(s)`,
        path: ['shifts'],
      })
      return
    }

    val.shifts.forEach((shift, i) => {
      if (shift.days.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select at least one day',
          path: ['shifts', i, 'days'],
        })
      }
      shift.days.forEach((d, j) => {
        if (d.splits.length !== val.split_number) {
          ctx.addIssue({
            code: 'custom',
            message: `Add ${val.split_number} time range(s)`,
            path: ['shifts', i, 'days', j, 'splits'],
          })
        }
      })

      if (shift.has_break && shift.break_hours != null && shift.days.length) {
        const minDayHours = Math.min(
          ...shift.days.map((d) =>
            d.splits.reduce((sum, s) => sum + rangeHours(s), 0)
          )
        )
        if (shift.break_hours > minDayHours) {
          ctx.addIssue({
            code: 'custom',
            message: 'Break hours must be less than the working hours',
            path: ['shifts', i, 'break_hours'],
          })
        }
      }
    })

    if (val.shift_number > 1) {
      if (!val.shift_cycle) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select a shift cycle',
          path: ['shift_cycle'],
        })
      }

      if (!val.shift_rotation) {
        ctx.addIssue({
          code: 'custom',
          message: 'Select a shift rotation',
          path: ['shift_rotation'],
        })
      } else if (
        val.shift_cycle &&
        !SHIFT_ROTATIONS_BY_CYCLE[val.shift_cycle].includes(val.shift_rotation)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Rotation is not valid for the selected shift cycle',
          path: ['shift_rotation'],
        })
      }

      if (val.repeated_shift == null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Set the repeated shift',
          path: ['repeated_shift'],
        })
      }
    }
  })

const commonScheduleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
})

export const scheduleSchema = z
  .discriminatedUnion('parent_type', [dailyScheduleSchema, regularScheduleSchema])
  .and(commonScheduleSchema)

export type Schedule = z.infer<typeof scheduleSchema>
export type ParentScheduleType = Schedule['parent_type']
export type DailySchedule = Extract<Schedule, { parent_type: 'daily' }>
export type RegularSchedule = Extract<Schedule, { parent_type: 'regular' }>
export type ScheduleType = DailySchedule['type']
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]
export type TimeRange = z.infer<typeof timeRangeSchema>
export type DaySchedule = z.infer<typeof dayScheduleSchema>
export type PolicyType = z.infer<typeof policyTypeSchema>
export type SingleShift = z.infer<typeof singleShiftSchema>
export type RegularShift = z.infer<typeof regularShiftSchema>
export type RegularShiftDay = z.infer<typeof regularShiftDaySchema>
export type ShiftCycle = z.infer<typeof shiftCycleSchema>
export type ShiftRotation = z.infer<typeof shiftRotationSchema>
