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

// Shape *and* reality: the regex alone accepts `2026-02-31`, which then
// silently becomes March 3rd wherever the string is turned into a Date, and
// `2026-13-45`, which becomes an Invalid Date. Round-tripped through UTC
// because local parsing shifts the day in negative offsets.
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Required')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    )
  }, 'Enter a real calendar date')

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
    start_date: dateStringSchema,
    end_date: dateStringSchema,
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
// --- fixed / flexible: shift selection ---
//
// `shift_ids` references the `shifts` feature's own store; a schedule has no
// per-shift override, so changing days/hours means editing the Shift itself.
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

// No frequency/weekday picker — which days a schedule runs comes entirely
// from its selected shifts' own days.
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

// Fixed/flexible only — rotate covers the same ground via its own cycle/pattern config.
const regularSharedSchema = z.object({
  start_date: dateStringSchema,
  end_settings: endSettingsSchema,
})

// --- rotate: cycle / pattern config ---

// "Rotate pattern" builds the cycle day by day; "Custom alternate" seeds the
// same per-day pattern from each shift's repeat count. Both drive `pattern`.
export const CYCLE_TYPES = ['pattern_shifts', 'custom_shifts'] as const
const cycleTypeSchema = z.enum(CYCLE_TYPES)

export const CYCLE_LENGTH_UNITS = ['weekly', 'monthly', 'custom_days'] as const
const cycleLengthSchema = z.object({
  unit: z.enum(CYCLE_LENGTH_UNITS),
  days: z.number().min(1),
})

// The pattern is a *template* — one crew's journey through the cycle
// ("Morning, Morning, off, Afternoon…") — not a declaration of what runs each
// day. Every selected shift is meant to run every day; `day_coverage` records
// that. Crews do not live on a pattern card.
const rotatePatternEntrySchema = z.object({
  position: z.number().min(1),
  shift_id: z.string().optional(),
  is_off: z.boolean(),
})

// The rotation roster as an explicit (cycle day × shift) → crews matrix.
// Storing the resolved matrix (not an offset per crew) decouples pattern from
// coverage and lets the manual grid edit one cell without dragging a crew's
// whole journey. Sparse: an absent cell means unstaffed, warned not errored.
const rotateDayCoverageSchema = z.object({
  day: z.number().int().min(0), // 0-based, indexes the pattern card
  shift_id: z.string().min(1),
  employee_ids: z.array(z.string()).default([]),
  team_ids: z.array(z.string()).default([]),
})

// "Custom shifts" mode: pattern length is the plain sum of all repeat
// intervals (no unit conversion — weekly x3 + daily x5 = 8 cards). A card's
// real calendar-day span depends on `frequency` (see `expandRotatePatternDays`
// in `utils.ts`); `monthly` is parity-only for now, behaving like daily.
export const SHIFT_REPEAT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

// Mirrors `shifts`' own "Repeat" tab (minus end-frequency, since the
// pattern's length already bounds it). Own copy, not an import — `shifts` is
// a standalone feature.
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
// `day_coverage` stays the source of truth (free cell editing can put a crew
// somewhere no offset pair would); this only answers "Team B starts week 2".
// Not tracked by a staleness flag — re-derived via `dayCoverageMatchesPlacements`
// by regenerating and comparing, so a hand edit can't leave a stale flag behind.
const rotateCrewPlacementSchema = z.object({
  crew: z.string().min(1), // `team:<id>` / `employee:<id>`, matches the pool key
  day_offset: z.number().int().min(0), // cycle card this crew stands on at day 0
  // shift-list transposition, ordered by start time — see `shiftForCard` in rotation-suggestion.ts
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

// --- rotate: who the roster is drawn from ---
//
// Optional so older saved schedules still load — the form recovers the pick
// from `day_coverage` (see `crewSelectionFromDayCoverage`). Fixed keeps only
// `crew_kind`; its crews live on `shift_assignments`.
export const CREW_KINDS = ['team', 'employee'] as const

const crewSelectionSchema = z.object({
  crew_kind: z.enum(CREW_KINDS).optional(),
  crew_ids: z.array(z.string()).optional(),
})

// --- recurrence rules: shared by rotate's repeat rows and fixed's occurrences ---
//
// Only the fields each frequency needs are required, so one check serves
// every rule-shaped row; `path` prefixes the row's own location.
type RecurrenceRuleShape = {
  frequency: string
  weekdays?: string[]
  monthly_mode?: string
  day_of_month?: number
  date_specific_1?: number
  date_specific_2?: number
  day_position_rules?: unknown[]
}

function refineRecurrenceRule(
  rule: RecurrenceRuleShape,
  ctx: z.RefinementCtx,
  path: (string | number)[]
) {
  const at = (field: string) => [...path, field]

  if (rule.frequency === 'weekly' && !rule.weekdays?.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Select at least one day',
      path: at('weekdays'),
    })
  }

  if (rule.frequency !== 'monthly') return
  if (!rule.monthly_mode) {
    ctx.addIssue({
      code: 'custom',
      message: 'Select how it repeats monthly',
      path: at('monthly_mode'),
    })
  } else if (rule.monthly_mode === 'day_month' && !rule.day_of_month) {
    ctx.addIssue({
      code: 'custom',
      message: 'Select the day of the month',
      path: at('day_of_month'),
    })
  } else if (rule.monthly_mode === 'date_specific') {
    if (!rule.date_specific_1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select the first date',
        path: at('date_specific_1'),
      })
    }
    if (!rule.date_specific_2) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select the second date',
        path: at('date_specific_2'),
      })
    }
  } else if (
    rule.monthly_mode === 'day_position' &&
    !rule.day_position_rules?.length
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Add a day-position rule',
      path: at('day_position_rules'),
    })
  }
}

// --- fixed: occurrence, one rule per selected shift ---
//
// Fixed's counterpart of rotate's "Custom alternate": every shift says on
// which days it runs, independently of the others.
export const OCCURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export const DEFAULT_OCCURRENCE = {
  frequency: 'weekly' as const,
  interval: 1,
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] as ShiftRepeatWeekday[],
}

export const DEFAULT_OCCURRENCE_EXCEPTIONS = {
  public_holiday: false,
  sick_leave: false,
}

const shiftOccurrenceSchema = z
  .object({
    shift_id: z.string().min(1),
    frequency: z.enum(OCCURRENCE_FREQUENCIES),
    interval: z.number().min(1),
    weekdays: z.array(shiftRepeatWeekdaySchema).optional(),
    // Monthly only — the same sub-modes as rotate's per-shift repeat rows,
    // rendered by the shared `RepeatMonthlyFields`.
    monthly_mode: shiftRepeatMonthlyModeSchema.optional(),
    day_of_month: z.number().min(1).max(28).optional(),
    date_specific_1: z.number().min(1).max(28).optional(),
    date_specific_2: z.number().min(1).max(28).optional(),
    day_position_rules: z
      .array(shiftRepeatDayPositionRuleSchema)
      .max(1)
      .optional(),
  })
  .superRefine((val, ctx) => refineRecurrenceRule(val, ctx, []))

const occurrenceExceptionsSchema = z.object({
  public_holiday: z.boolean().default(false),
  sick_leave: z.boolean().default(false),
})

// --- fixed: who works each shift ---
//
// Per shift rather than per day: which days a shift runs is its occurrence's
// business. The same crew may be on several shifts — the step warns, it
// doesn't forbid.
const shiftAssignmentSchema = z.object({
  shift_id: z.string().min(1),
  employee_ids: z.array(z.string()).default([]),
  team_ids: z.array(z.string()).default([]),
})

// --- assemble the three `regular` arms ---

const regularFixedSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('fixed'),
  ...regularSharedSchema.shape,
  ...shiftDefinitionFieldsSchema.shape,
  shift_occurrences: z.array(shiftOccurrenceSchema).default([]),
  occurrence_exceptions: occurrenceExceptionsSchema.default(
    DEFAULT_OCCURRENCE_EXCEPTIONS
  ),
  crew_kind: z.enum(CREW_KINDS).optional(),
  shift_assignments: z.array(shiftAssignmentSchema).default([]),
})

const regularFlexibleSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('flexible'),
  ...regularSharedSchema.shape,
  ...shiftDefinitionFieldsSchema.shape,
})

// Rotate diverges from fixed/flexible only at its cycle/pattern config; start
// date and end settings are shared via "Start & End".
const regularRotateSchema = z.object({
  parent_type: z.literal('regular'),
  type: z.literal('rotate'),
  ...shiftDefinitionFieldsSchema.shape,
  ...rotateFieldsSchema.shape,
  ...crewSelectionSchema.shape,
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
    // `endSettingsSchema` can only see its own object, so the one rule that
    // needs both dates lives here. ISO strings compare chronologically, so
    // no parsing is needed.
    if (
      val.end_settings.end_type === 'on_date' &&
      val.end_settings.end_date &&
      val.end_settings.end_date < val.start_date
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'End date must be on or after the start date',
        path: ['end_settings', 'end_date'],
      })
    }

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

    if (val.type === 'fixed') {
      val.shift_ids.forEach((shiftId) => {
        const rows = val.shift_occurrences.filter(
          (row) => row.shift_id === shiftId
        ).length
        if (rows !== 1) {
          ctx.addIssue({
            code: 'custom',
            message:
              rows === 0
                ? 'Set how often every selected shift occurs'
                : 'Each shift can only have one occurrence',
            path: ['shift_occurrences'],
          })
        }
      })

      val.shift_assignments.forEach((assignment, i) => {
        if (!val.shift_ids.includes(assignment.shift_id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Assigned shift is not one of this schedule’s shifts',
            path: ['shift_assignments', i, 'shift_id'],
          })
        }
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

      // Well-formed only — an unstaffed shift is a warning, never a
      // validation error; fixability depends on crew count, not data shape.
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

      // Well-formed only, same as `day_coverage` — a stale placement is not
      // an error, the step reports the mismatch in place.
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

        val.shift_repeat.forEach((r, i) => {
          // Cards stay reassignable after auto-population, so this catches an
          // edit that pushes one shift past its own repeat interval.
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

          refineRecurrenceRule(r, ctx, ['shift_repeat', i])
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
export type ShiftOccurrence = z.infer<typeof shiftOccurrenceSchema>
// A rule without the shift it belongs to — what the date maths needs.
export type OccurrenceRule = Omit<ShiftOccurrence, 'shift_id'>
export type OccurrenceExceptions = z.infer<typeof occurrenceExceptionsSchema>
export type ShiftAssignment = z.infer<typeof shiftAssignmentSchema>
export type CrewKind = (typeof CREW_KINDS)[number]
export type RotateCrewPlacement = Extract<
  RegularSchedule,
  { type: 'rotate' }
>['crew_placements'][number]
