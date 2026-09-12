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
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Required')

// --- fixed / flexible: shift selection ---
//
// `shift_ids` references records in the standalone `shifts` feature's store
// rather than inlining a shift's name/days/hours. A schedule inherits whatever
// the referenced Shift defines — there is no per-schedule override, so running
// a shift on different days means editing the Shift.
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

// Just "when does this arrangement stop". No frequency/weekday picker, since
// which days a schedule runs comes entirely from its selected shifts' own days.
export const endSettingsSchema = z
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

// Step 3, fixed/flexible only — rotate covers the same ground through its own
// cycle/pattern config.
const regularSharedSchema = z.object({
  start_date: dateStringSchema,
  end_settings: endSettingsSchema,
})

// --- rotate: cycle / pattern config ---

// "Rotate pattern" builds the cycle day by day. "Custom alternate" starts from
// how many times each selected shift repeats and seeds the same per-day
// pattern, editable afterwards — both drive the same `pattern` array.
export const CYCLE_TYPES = ['pattern_shifts', 'custom_shifts'] as const
const cycleTypeSchema = z.enum(CYCLE_TYPES)

export const CYCLE_LENGTH_UNITS = ['weekly', 'monthly', 'custom_days'] as const
const cycleLengthSchema = z.object({
  unit: z.enum(CYCLE_LENGTH_UNITS),
  days: z.number().min(1),
})

// A pattern day points at one of the schedule's own selected shifts, resolved
// against `shift_ids`.
//
// The pattern is a *template*, not a declaration of what runs each day: it
// describes one crew's journey through the cycle — "Morning, Morning, off,
// Afternoon, …" — and shapes the suggestion on the "Assign to" step, nothing
// more. What actually runs each day is decided by `shift_ids`: every selected
// shift is meant to be covered every day, which is what `day_coverage` records.
// Crews therefore do not live on a pattern card at all.
const rotatePatternEntrySchema = z.object({
  position: z.number().min(1),
  shift_id: z.string().optional(),
  is_off: z.boolean(),
})

// The rotation roster, as an explicit (cycle day × shift) → crews matrix.
//
// Storing the resolved matrix rather than an offset per crew is what decouples
// the pattern from what runs: an all-Morning 5-2 pattern could otherwise never
// staff Night however many crews were added. It is also what lets the manual
// grid edit one cell without dragging a whole crew's journey with it.
//
// Sparse: only cells with somebody on them are stored, so an empty cell and an
// absent one mean the same thing — that shift is unstaffed that day, which is
// reported as a warning, never a validation error.
const rotateDayCoverageSchema = z.object({
  // 0-based cycle day, i.e. the index of the pattern card it lines up with.
  day: z.number().int().min(0),
  shift_id: z.string().min(1),
  employee_ids: z.array(z.string()).default([]),
  team_ids: z.array(z.string()).default([]),
})

// "Custom shifts" mode: each selected shift gets its own repeat config. The
// pattern's length is the plain sum of all intervals (weekly x3 contributes 3
// cards, daily x5 contributes 5 — no unit conversion), and that card order is
// the order the shifts appear on the calendar.
//
// A card's real calendar-day span depends on `frequency` (see
// `expandRotatePatternDays` in `utils.ts`): a daily card is a single day; a
// weekly card spans a real week, active only on that shift's own `weekdays`.
// `monthly`'s fields are parity-only for now — a monthly card behaves like a
// daily one until a later pass wires them up.
export const SHIFT_REPEAT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

// Each shift's repeat row reuses `shifts`' own "Repeat" tab fields so the two
// features present identical UI, minus the end-frequency section — the
// pattern's length already bounds how long each shift repeats. The enums are
// deliberately its own copy rather than an import, since `shifts` is a
// standalone feature.
export const SHIFT_REPEAT_WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const
const shiftRepeatWeekdaySchema = z.enum(SHIFT_REPEAT_WEEKDAYS)

export const SHIFT_REPEAT_MONTHLY_MODES = [
  'day_month',
  'date_specific',
  'day_position',
] as const
const shiftRepeatMonthlyModeSchema = z.enum(SHIFT_REPEAT_MONTHLY_MODES)

const shiftRepeatDayPositionRuleSchema = z.object({
  position: z.number().min(1).max(28),
  weekday: shiftRepeatWeekdaySchema,
})

const shiftRepeatSchema = z.object({
  shift_id: z.string(),
  frequency: z.enum(SHIFT_REPEAT_FREQUENCIES),
  interval: z.number().min(1),
  weekdays: z.array(shiftRepeatWeekdaySchema).optional(),
  // Monthly only — which of the 3 sub-modes below is active.
  monthly_mode: shiftRepeatMonthlyModeSchema.optional(),
  // monthly_mode === 'day_month'
  day_of_month: z.number().min(1).max(28).optional(),
  // monthly_mode === 'date_specific'
  date_specific_1: z.number().min(1).max(28).optional(),
  date_specific_2: z.number().min(1).max(28).optional(),
  // monthly_mode === 'day_position'
  day_position_rules: z
    .array(shiftRepeatDayPositionRuleSchema)
    .max(1)
    .optional(),
})

// How the roster was *generated*, stored next to the matrix it produced.
//
// `day_coverage` stays the source of truth — free cell editing can put a crew
// somewhere no pair of offsets would — but the matrix alone cannot answer the
// question every real-world rotation is written in: "Team B starts on week 2".
//
// Deliberately not a second source of truth. Whether these still describe the
// stored cells is re-derived by regenerating and comparing (see
// `dayCoverageMatchesPlacements`), never tracked by a flag that could drift. A
// hand edit simply stops them matching, and the step says so rather than
// silently re-applying them over the edit.
const rotateCrewPlacementSchema = z.object({
  // `team:<id>` or `employee:<id>` — the same crew key the suggestion and the
  // "Assign to" step's pool both use.
  crew: z.string().min(1),
  // Which cycle card this crew stands on at day 0.
  day_offset: z.number().int().min(0),
  // How far its journey is transposed through the shift list, ordered by
  // start time — see `shiftForCard` in `rotation-suggestion.ts`.
  shift_step: z.number().int().min(0),
})

const rotateFieldsSchema = z.object({
  cycle_type: cycleTypeSchema,
  cycle_length: cycleLengthSchema,
  pattern: z.array(rotatePatternEntrySchema).min(1),
  shift_repeat: z.array(shiftRepeatSchema).default([]),
  day_coverage: z.array(rotateDayCoverageSchema).default([]),
  crew_placements: z.array(rotateCrewPlacementSchema).default([]),
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

// Rotate shares steps 1 and 2 with fixed/flexible and only diverges at step 3,
// its own cycle/pattern config. Start date and end settings are the same, in a
// shared "Start & End" step.
const regularRotateSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('rotate'),
  ...shiftDefinitionFieldsSchema.shape,
  ...rotateFieldsSchema.shape,
  start_date: dateStringSchema,
  end_settings: endSettingsSchema,
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

    // A rotation needs at least 2 shifts to alternate between; fixed/flexible
    // are fine with one.
    if (val.type === 'rotate' && val.shift_ids.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select at least 2 shifts to build a rotation',
        path: ['shift_ids'],
      })
    }

    if (val.type === 'rotate') {
      // pattern_shifts: length matches cycle_length.days. custom_shifts: length
      // is the plain sum of all repeat intervals (weekly x3 + daily x5 => 8).
      const expectedPatternLength =
        val.cycle_type === 'custom_shifts'
          ? val.shift_repeat.reduce((sum, r) => sum + r.interval, 0)
          : val.cycle_length.days

      if (val.pattern.length !== expectedPatternLength) {
        ctx.addIssue({
          code: 'custom',
          message:
            val.cycle_type === 'custom_shifts'
              ? `Pattern must have ${expectedPatternLength} card(s) based on shift repeat settings`
              : `Assign all ${val.cycle_length.days} day(s) of the cycle`,
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

      // `day_coverage` is only checked for being *well formed*. A shift left
      // unstaffed on some day is deliberately not an error: the coverage panel
      // warns and "Next" still advances, because whether a hole is fixable
      // depends on the crew count, not on the shape of the data.
      const seenCells = new Set<string>()
      val.day_coverage.forEach((cell, i) => {
        if (!val.shift_ids.includes(cell.shift_id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Assigned shift is not one of this schedule’s shifts',
            path: ['day_coverage', i, 'shift_id'],
          })
        }

        if (cell.day >= val.pattern.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Assigned day falls outside the cycle',
            path: ['day_coverage', i, 'day'],
          })
        }

        const key = `${cell.day}:${cell.shift_id}`
        if (seenCells.has(key)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Each shift can only be assigned once per cycle day',
            path: ['day_coverage', i],
          })
        }
        seenCells.add(key)
      })

      // Well-formedness only, same as `day_coverage`. Placements that no longer
      // describe the matrix are not an error — hand-editing a cell is
      // supported, and the step reports the mismatch in place.
      const seenCrews = new Set<string>()
      val.crew_placements.forEach((placement, i) => {
        if (placement.day_offset >= val.pattern.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Crew start day falls outside the cycle',
            path: ['crew_placements', i, 'day_offset'],
          })
        }

        if (placement.shift_step >= Math.max(val.shift_ids.length, 1)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Shift track falls outside this schedule’s shifts',
            path: ['crew_placements', i, 'shift_step'],
          })
        }

        if (seenCrews.has(placement.crew)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Each crew can only be placed once',
            path: ['crew_placements', i, 'crew'],
          })
        }
        seenCrews.add(placement.crew)
      })

      if (val.cycle_type === 'custom_shifts') {
        if (val.shift_repeat.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Add at least one shift repeat configuration',
            path: ['shift_repeat'],
          })
        }

        const repeatShiftIds = val.shift_repeat.map((r) => r.shift_id)
        const invalidIds = repeatShiftIds.filter(
          (id) => !val.shift_ids.includes(id)
        )
        if (invalidIds.length > 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Shift repeat references a shift not in the selection',
            path: ['shift_repeat'],
          })
        }

        // The same per-frequency requirements as shifts' own "Repeat" tab,
        // minus its end-frequency checks.
        val.shift_repeat.forEach((r, i) => {
          // The grid auto-populates each shift's exact `interval` count of
          // cards, but every card stays reassignable — this is the safety net
          // for an edit that pushes one shift past its own interval.
          const assignedCount = val.pattern.filter(
            (p) => !p.is_off && p.shift_id === r.shift_id
          ).length
          if (assignedCount > r.interval) {
            ctx.addIssue({
              code: 'custom',
              message: `This shift is assigned to ${assignedCount} day(s) in the pattern, but its repeat settings only allow ${r.interval}`,
              path: ['pattern'],
            })
          }

          if (r.frequency === 'weekly' && !r.weekdays?.length) {
            ctx.addIssue({
              code: 'custom',
              message: 'Select at least one day',
              path: ['shift_repeat', i, 'weekdays'],
            })
          }

          if (r.frequency === 'monthly') {
            if (!r.monthly_mode) {
              ctx.addIssue({
                code: 'custom',
                message: 'Select how it repeats monthly',
                path: ['shift_repeat', i, 'monthly_mode'],
              })
            } else if (r.monthly_mode === 'day_month' && !r.day_of_month) {
              ctx.addIssue({
                code: 'custom',
                message: 'Select the day of the month',
                path: ['shift_repeat', i, 'day_of_month'],
              })
            } else if (r.monthly_mode === 'date_specific') {
              if (!r.date_specific_1) {
                ctx.addIssue({
                  code: 'custom',
                  message: 'Select the first date',
                  path: ['shift_repeat', i, 'date_specific_1'],
                })
              }
              if (!r.date_specific_2) {
                ctx.addIssue({
                  code: 'custom',
                  message: 'Select the second date',
                  path: ['shift_repeat', i, 'date_specific_2'],
                })
              }
            } else if (
              r.monthly_mode === 'day_position' &&
              !r.day_position_rules?.length
            ) {
              ctx.addIssue({
                code: 'custom',
                message: 'Add a day-position rule',
                path: ['shift_repeat', i, 'day_position_rules'],
              })
            }
          }
        })
      }
    }
  })

const commonScheduleSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  // Step 1's template picker. Wiring templates to pre-fill a schedule is a
  // follow-up; for now this only records the pick.
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
export type ShiftRepeatFrequency = (typeof SHIFT_REPEAT_FREQUENCIES)[number]
export type ShiftRepeatWeekday = (typeof SHIFT_REPEAT_WEEKDAYS)[number]
export type ShiftRepeatMonthlyMode = (typeof SHIFT_REPEAT_MONTHLY_MODES)[number]
export type RotatePatternEntry = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['pattern'][number]
export type ShiftRepeat = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['shift_repeat'][number]
export type RotateDayCoverage = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['day_coverage'][number]
export type RotateCrewPlacement = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['crew_placements'][number]
