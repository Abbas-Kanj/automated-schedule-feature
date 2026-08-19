import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SelectDropdown } from '@/components/select-dropdown'
import { RecurrenceFrequencyFields } from '@/components/recurrence-frequency-fields'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import {
  CYCLE_LENGTH_QUICK_PICKS,
  CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS,
  CYCLE_LENGTH_UNIT_OPTIONS,
  CYCLE_TYPE_OPTIONS,
  SHIFT_REPEAT_FREQUENCY_OPTIONS,
} from '../../data/data'
import { type RotatePatternEntry, type ShiftRepeat } from '../../data/schema'
import { DirectionPreview } from './direction-preview'

type PatternBuilderProps = {
  disabled?: boolean
}

export function PatternBuilder({ disabled }: PatternBuilderProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const shiftIds = (useWatch({ control, name: 'shift_ids' }) as
    | string[]
    | undefined) ?? []
  const cycleLength = useWatch({ control, name: 'cycle_length' }) as
    | { unit: string; days: number }
    | undefined
  const cycleType = useWatch({ control, name: 'cycle_type' }) as
    | string
    | undefined
  const shiftRepeatRaw = useWatch({ control, name: 'shift_repeat' }) as
    | ShiftRepeat[]
    | undefined
  const shiftRepeat = useMemo(() => shiftRepeatRaw ?? [], [shiftRepeatRaw])

  const isCustomShifts = cycleType === 'custom_shifts'
  const days = cycleLength?.days ?? 0

  const totalPatternLength = isCustomShifts
    ? shiftRepeat.reduce((sum, r) => sum + r.interval, 0)
    : days

  const { fields, replace } = useFieldArray({ control, name: 'pattern' })

  // Pattern_shifts: keep pattern synced with cycle_length.days
  useEffect(() => {
    if (isCustomShifts) return
    if (!days) return
    const current =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    if (current.length === days) return
    const next = Array.from(
      { length: days },
      (_, i) =>
        current[i] ?? { position: i + 1, is_off: true, shift_id: undefined }
    )
    replace(next)
  }, [days, isCustomShifts])

  // Custom_shifts: auto-populate pattern from shift_repeat settings
  useEffect(() => {
    if (!isCustomShifts) return
    if (totalPatternLength <= 0) {
      replace([])
      return
    }
    const next: RotatePatternEntry[] = []
    let position = 1
    for (const r of shiftRepeat) {
      for (let i = 0; i < r.interval; i++, position++) {
        next.push({ position, is_off: false, shift_id: r.shift_id })
      }
    }
    while (position <= totalPatternLength) {
      next.push({ position, is_off: true, shift_id: undefined })
      position++
    }
    replace(next)
  }, [isCustomShifts, totalPatternLength, shiftRepeat, replace])

  // Every day's dropdown picks from the shifts selected back in the
  // "Shifts" step — no more hand-authored blocks (see `data/schema.ts`).
  const shiftOptions = shiftIds
    .map((id) => shifts.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => ({ value: s.id, label: s.name }))

  return (
    <div className='space-y-4'>
      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-sm font-medium'>Create pattern</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 px-4'>
          <FormField
            control={control}
            name='cycle_type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pattern type</FormLabel>
                <SelectDropdown
                  isControlled
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  placeholder='Select a pattern type'
                  items={CYCLE_TYPE_OPTIONS}
                  disabled={disabled}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {!isCustomShifts && (
        <Card className='gap-3 py-4'>
          <CardHeader className='px-4'>
            <CardTitle className='text-sm font-medium'>Cycle length</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 px-4'>
            <FormField
              control={control}
              name='cycle_length.unit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <SelectDropdown
                    isControlled
                    defaultValue={field.value}
                    onValueChange={(unit) => {
                      field.onChange(unit)
                      const multiplier =
                        CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS[
                          unit as keyof typeof CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS
                        ]
                      if (multiplier) {
                        setValue('cycle_length.days', multiplier, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      } else if (!cycleLength?.days) {
                        setValue('cycle_length.days', 7, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    }}
                    placeholder='Select a unit'
                    items={CYCLE_LENGTH_UNIT_OPTIONS}
                    disabled={disabled}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {cycleLength?.unit === 'custom_days' ? (
              <FormField
                control={control}
                name='cycle_length.days'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cycle length (days)</FormLabel>
                    <FormControl>
                      <input
                        type='number'
                        min={1}
                        className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
                        disabled={disabled}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    {!disabled && (
                      <div className='flex flex-wrap gap-1.5 pt-1'>
                        {CYCLE_LENGTH_QUICK_PICKS.map((quickPickDays) => (
                          <Button
                            key={quickPickDays}
                            type='button'
                            variant='outline'
                            size='sm'
                            className={cn(
                              'h-7',
                              cycleLength?.days === quickPickDays &&
                                'border-primary'
                            )}
                            onClick={() => field.onChange(quickPickDays)}
                          >
                            {quickPickDays}
                          </Button>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={control}
                name='cycle_length.days'
                render={({ field }) => {
                  const isMonthly = cycleLength?.unit === 'monthly'
                  const multiplier = isMonthly ? 30 : 7
                  const count = field.value
                    ? Math.round(field.value / multiplier)
                    : ''
                  return (
                    <FormItem>
                      <FormLabel>
                        Cycle length ({isMonthly ? 'month(s)' : 'week(s)'})
                      </FormLabel>
                      <FormControl>
                        <input
                          type='number'
                          min={1}
                          className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
                          disabled={disabled}
                          value={count}
                          onChange={(e) => {
                            const nextCount = e.target.valueAsNumber
                            field.onChange(
                              Number.isNaN(nextCount)
                                ? undefined
                                : nextCount * multiplier
                            )
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {isCustomShifts && shiftOptions.length > 0 && (
        <ShiftRepeats shiftIds={shiftIds} disabled={disabled} />
      )}

      {((isCustomShifts && totalPatternLength > 0) ||
        (!isCustomShifts && days > 0)) &&
        shiftOptions.length > 0 && (
          <Card className='gap-3 py-4'>
            <CardHeader className='px-4'>
              <CardTitle className='text-sm font-medium'>Pattern</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 px-4'>
              <PatternDayGrid
                fields={fields}
                shiftOptions={shiftOptions}
                cycleLengthUnit={cycleLength?.unit}
                disabled={disabled}
              />
            </CardContent>
          </Card>
        )}

      {!isCustomShifts && !days && (
        <p className='text-sm text-muted-foreground'>
          Set the cycle length to build the pattern.
        </p>
      )}

      {shiftOptions.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          Pick shifts in the previous step to assign them to days.
        </p>
      )}

      <DirectionPreview />
    </div>
  )
}

type ShiftRepeatsProps = {
  shiftIds: string[]
  disabled?: boolean
}

function ShiftRepeats({ shiftIds, disabled }: ShiftRepeatsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const { replace } = useFieldArray({ control, name: 'shift_repeat' })

  // Keep one repeat row per currently-selected shift, preserving existing
  // repeat settings when a shift is already configured.
  const shiftIdsKey = shiftIds.join(',')
  useEffect(() => {
    const current =
      (getValues('shift_repeat') as ShiftRepeat[] | undefined) ?? []
    const next = shiftIds.map(
      (id) =>
        current.find((r) => r.shift_id === id) ?? {
          shift_id: id,
          frequency: 'daily' as const,
          interval: 1,
        }
    )
    const changed =
      next.length !== current.length ||
      next.some((r, i) => r.shift_id !== current[i]?.shift_id)
    if (changed) replace(next)
  }, [shiftIdsKey])

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-sm font-medium'>Shift repeats</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4'>
        {shiftIds.map((shiftId, index) => {
          const shift = shifts.find((s) => s.id === shiftId)
          return (
            <div key={shiftId} className='space-y-3'>
              <p className='text-sm font-medium'>
                {shift?.name ?? 'Shift'}
              </p>
              <RecurrenceFrequencyFields
                control={control}
                name={`shift_repeat.${index}`}
                frequencyOptions={SHIFT_REPEAT_FREQUENCY_OPTIONS}
                weekdayOptions={[]}
                hideWeekdays
                disabled={disabled}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

type PatternDayGridProps = {
  fields: { id: string }[]
  shiftOptions: { value: string; label: string }[]
  cycleLengthUnit?: string
  disabled?: boolean
}

// A monthly cycle's day count is always a multiple of this (see the
// month-count input in the Cycle length card, which stores `count * 30`) —
// used to split the cycle into one box per month.
const DAYS_PER_MONTH_BOX = 30

function PatternDayGrid({
  fields,
  shiftOptions,
  cycleLengthUnit,
  disabled,
}: PatternDayGridProps) {
  const [openMonthIndex, setOpenMonthIndex] = useState<number | null>(null)
  const isMonthly = cycleLengthUnit === 'monthly'

  // Weekly/custom-days cycles are short enough (max 7 per row) to show
  // directly.
  if (!isMonthly) {
    return (
      <div className='grid grid-cols-3 gap-2 sm:grid-cols-7'>
        {fields.map((field, index) => (
          <PatternDayCard
            key={field.id}
            index={index}
            shiftOptions={shiftOptions}
            disabled={disabled}
          />
        ))}
      </div>
    )
  }

  // Monthly cycles can span several months — too many day cards to show
  // inline, so they're split into one box per month; clicking a box opens
  // just that month's days in a modal.
  const months = Array.from(
    { length: Math.ceil(fields.length / DAYS_PER_MONTH_BOX) },
    (_, i) => {
      const start = i * DAYS_PER_MONTH_BOX
      const end = Math.min(start + DAYS_PER_MONTH_BOX, fields.length)
      return { index: i, start, end }
    }
  )
  const openMonth =
    openMonthIndex != null ? months[openMonthIndex] : undefined

  return (
    <>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        {months.map((month) => (
          <button
            key={month.index}
            type='button'
            onClick={() => setOpenMonthIndex(month.index)}
            disabled={disabled}
            className='flex flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-4 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60'
          >
            <span className='font-medium'>Month {month.index + 1}</span>
            <span className='text-xs text-muted-foreground'>
              Days {month.start + 1}–{month.end}
            </span>
          </button>
        ))}
      </div>
      <Dialog
        open={openMonth != null}
        onOpenChange={(open) => !open && setOpenMonthIndex(null)}
      >
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>
              Month {openMonth ? openMonth.index + 1 : ''}
            </DialogTitle>
          </DialogHeader>
          {openMonth && (
            <div className='grid max-h-[65vh] grid-cols-3 gap-2 overflow-y-auto pe-1 sm:grid-cols-7'>
              {fields.slice(openMonth.start, openMonth.end).map((field, i) => (
                <PatternDayCard
                  key={field.id}
                  index={openMonth.start + i}
                  shiftOptions={shiftOptions}
                  disabled={disabled}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

type PatternDayCardProps = {
  index: number
  shiftOptions: { value: string; label: string }[]
  disabled?: boolean
}

function PatternDayCard({ index, shiftOptions, disabled }: PatternDayCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const isOff = useWatch({ control, name: `pattern.${index}.is_off` })
  const shiftId = useWatch({ control, name: `pattern.${index}.shift_id` }) as
    | string
    | undefined
  const value = !isOff && shiftId ? shiftId : 'off'
  const items = [{ value: 'off', label: 'Off' }, ...shiftOptions]

  const assignedShift = shiftId ? shifts.find((s) => s.id === shiftId) : null
  const Icon = assignedShift
    ? SHIFT_ICON_COMPONENTS[assignedShift.icon]
    : undefined
  const color = assignedShift
    ? SHIFT_BADGE_COLOR_OPTIONS.find(
        (o) => o.value === assignedShift.badge_color
      )
    : undefined

  return (
    <Card className='gap-1 py-2'>
      <CardContent className='space-y-1 px-2'>
        <div className='flex min-h-4 items-center justify-center gap-1'>
          {assignedShift && (
            <>
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  color?.swatchClassName
                )}
              />
              {Icon && <Icon className='size-3 shrink-0' />}
            </>
          )}
          <p className='truncate text-center text-xs text-muted-foreground'>
            {assignedShift
              ? assignedShift.name
              : isOff
                ? 'Off'
                : `Day ${index + 1}`}
          </p>
        </div>
        <SelectDropdown
          isControlled
          defaultValue={value}
          onValueChange={(v) => {
            if (v === 'off') {
              setValue(`pattern.${index}.is_off`, true, {
                shouldValidate: true,
              })
              setValue(`pattern.${index}.shift_id`, undefined, {
                shouldValidate: true,
              })
            } else {
              setValue(`pattern.${index}.is_off`, false, {
                shouldValidate: true,
              })
              setValue(`pattern.${index}.shift_id`, v, {
                shouldValidate: true,
              })
            }
          }}
          items={items}
          disabled={disabled}
          className='h-8 text-xs'
        />
      </CardContent>
    </Card>
  )
}
