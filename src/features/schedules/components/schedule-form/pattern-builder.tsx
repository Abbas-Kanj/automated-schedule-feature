import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { GripVerticalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { RecurrenceFrequencyFields } from '@/components/recurrence-frequency-fields'
import { RepeatMonthlyFields } from '@/components/repeat-monthly-fields'
import { SelectDropdown } from '@/components/select-dropdown'
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
  SHIFT_REPEAT_MONTHLY_MODE_OPTIONS,
  SHIFT_REPEAT_WEEKDAY_OPTIONS,
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
  const shiftIds =
    (useWatch({ control, name: 'shift_ids' }) as string[] | undefined) ?? []
  const cycleLength = useWatch({ control, name: 'cycle_length' }) as
    { unit: string; days: number } | undefined
  const cycleType = useWatch({ control, name: 'cycle_type' }) as
    string | undefined
  const shiftRepeatRaw = useWatch({ control, name: 'shift_repeat' }) as
    ShiftRepeat[] | undefined
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

  // Custom_shifts: auto-populate pattern from shift_repeat settings.
  //
  // `PatternBuilder` unmounts whenever the wizard leaves the "pattern" step
  // (see `schedule-form.tsx`'s `currentStepId === 'pattern'` gate) and
  // remounts fresh on the way back — so this effect also runs on every
  // return trip, not just when `shift_repeat` first changes. It must stay
  // idempotent against a `pattern` that already matches `shift_repeat`'s
  // composition (same shift_ids, same per-shift card counts), or it would
  // silently blow away a manual drag-reorder every time the user leaves and
  // returns to this step — only truly rebuild when the composition itself
  // has changed (a shift was added/removed, or an `interval` changed),
  // since only then does the old card order stop being valid.
  useEffect(() => {
    if (!isCustomShifts) return
    if (totalPatternLength <= 0) {
      replace([])
      return
    }

    const expectedCounts = new Map<string, number>()
    for (const r of shiftRepeat) {
      expectedCounts.set(
        r.shift_id,
        (expectedCounts.get(r.shift_id) ?? 0) + r.interval
      )
    }

    const current =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    const currentCounts = new Map<string, number>()
    for (const p of current) {
      if (!p.is_off && p.shift_id) {
        currentCounts.set(p.shift_id, (currentCounts.get(p.shift_id) ?? 0) + 1)
      }
    }
    const alreadyMatches =
      current.length === totalPatternLength &&
      expectedCounts.size === currentCounts.size &&
      [...expectedCounts].every(
        ([id, count]) => currentCounts.get(id) === count
      )
    if (alreadyMatches) return

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
  }, [isCustomShifts, totalPatternLength, shiftRepeat, replace, getValues])

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
          <CardTitle className='text-base font-semibold'>
            Create pattern
          </CardTitle>
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
            <CardTitle className='text-base font-semibold'>
              Cycle length
            </CardTitle>
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
                        setValue('cycle_length.days', 6, {
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
                      <Input
                        type='number'
                        min={1}
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
                  const multiplier = isMonthly ? 30 : 6
                  const count = field.value
                    ? Math.round(field.value / multiplier)
                    : ''
                  return (
                    <FormItem>
                      <FormLabel>
                        Cycle length ({isMonthly ? 'month(s)' : 'week(s)'})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
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
              <CardTitle className='text-base font-semibold'>Pattern</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 px-4'>
              <PatternDayGrid
                fields={fields}
                shiftOptions={shiftOptions}
                cycleLengthUnit={cycleLength?.unit}
                disabled={disabled}
                // "Custom alternate" cards are drag-to-swap only (each
                // shift's own repeat "interval" already fixes how many
                // cards it gets — see the auto-populate effect above — so
                // reassigning by picking from a dropdown isn't offered,
                // only reordering which day holds which shift).
                isCustomShifts={isCustomShifts}
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
  // repeat settings when a shift is already configured. Defaults to
  // "Weekly" (pre-selected, like shifts' own Repeat tab defaults to
  // "Daily" — see `shifts/data/defaults.ts`) with Monday pre-checked so a
  // freshly-added row isn't immediately invalid (weekly requires at least
  // one weekday — see the `shift_repeat` superRefine in `data/schema.ts`).
  const shiftIdsKey = shiftIds.join(',')
  useEffect(() => {
    const current =
      (getValues('shift_repeat') as ShiftRepeat[] | undefined) ?? []
    const next = shiftIds.map(
      (id) =>
        current.find((r) => r.shift_id === id) ?? {
          shift_id: id,
          frequency: 'weekly' as const,
          interval: 1,
          weekdays: ['mon'],
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
        <CardTitle className='text-base font-semibold'>Shift repeats</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4'>
        {shiftIds.map((shiftId, index) => {
          const shift = shifts.find((s) => s.id === shiftId)
          const Icon = shift ? SHIFT_ICON_COMPONENTS[shift.icon] : undefined
          const color = shift
            ? SHIFT_BADGE_COLOR_OPTIONS.find(
                (o) => o.value === shift.badge_color
              )
            : undefined
          return (
            <div key={shiftId} className='space-y-3'>
              <div className='flex items-center gap-2'>
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    color?.swatchClassName
                  )}
                />
                {Icon && (
                  <Icon className='size-4 shrink-0 text-muted-foreground' />
                )}
                <p className='text-sm font-medium'>{shift?.name ?? 'Shift'}</p>
              </div>
              <RecurrenceFrequencyFields
                control={control}
                name={`shift_repeat.${index}`}
                frequencyOptions={SHIFT_REPEAT_FREQUENCY_OPTIONS}
                weekdayOptions={SHIFT_REPEAT_WEEKDAY_OPTIONS}
                disabled={disabled}
                monthlyFields={
                  <RepeatMonthlyFields
                    control={control}
                    name={`shift_repeat.${index}`}
                    monthlyModeOptions={SHIFT_REPEAT_MONTHLY_MODE_OPTIONS}
                    weekdayOptions={SHIFT_REPEAT_WEEKDAY_OPTIONS}
                    disabled={disabled}
                  />
                }
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
  // "Custom alternate" only — swaps cards by drag-and-drop instead of a
  // per-day dropdown (see `PatternDayCard`).
  isCustomShifts?: boolean
}

// A monthly cycle's day count is always a multiple of this (see the
// month-count input in the Cycle length card, which stores `count * 30`) —
// used to split the cycle into one box per month.
const DAYS_PER_MONTH_BOX = 30

type DropTarget = { index: number; side: 'before' | 'after' }

// "Custom alternate" cards drag-reorder like a sortable list — dragging one
// card onto another *moves* it into that slot and shifts everything between
// the two over by one, rather than just exchanging the two cards' shifts
// (each shift's own repeat "interval" still fixes how many cards it holds
// in total — see the custom_shifts auto-populate effect in
// `PatternBuilder` — a move can't change that count any more than a swap
// could). Lives in the grid (not each card) since a drag started on one
// card needs to update state a sibling card renders (the drop-line
// indicator).
function usePatternReorder() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getValues, setValue } = useFormContext<any>()
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  return {
    draggingIndex,
    dropTarget,
    start(index: number) {
      setDraggingIndex(index)
    },
    hover(index: number, side: DropTarget['side']) {
      if (index === draggingIndex) {
        setDropTarget(null)
        return
      }
      setDropTarget((prev) =>
        prev?.index === index && prev.side === side ? prev : { index, side }
      )
    },
    end() {
      setDraggingIndex(null)
      setDropTarget(null)
    },
    drop() {
      const from = draggingIndex
      const to = dropTarget
      setDraggingIndex(null)
      setDropTarget(null)
      if (from == null || !to || from === to.index) return

      const pattern = getValues('pattern') as RotatePatternEntry[]
      const content = pattern.map((p) => ({
        is_off: p.is_off,
        shift_id: p.shift_id,
      }))
      const [moved] = content.splice(from, 1)
      let insertAt = to.side === 'after' ? to.index + 1 : to.index
      // Removing `from` shifted every later index left by one — account for
      // that before splicing back in.
      if (from < insertAt) insertAt--
      content.splice(insertAt, 0, moved)

      content.forEach((c, i) => {
        setValue(`pattern.${i}.shift_id`, c.shift_id, {
          shouldValidate: true,
          shouldDirty: true,
        })
        setValue(`pattern.${i}.is_off`, c.is_off, {
          shouldValidate: true,
          shouldDirty: true,
        })
      })
    },
  }
}

type PatternReorder = ReturnType<typeof usePatternReorder>

// Drag-to-reorder is only discoverable by trying it, so say so out loud
// wherever the draggable cards render (inline grid and the per-month
// dialog alike). Only shown when the cards are actually draggable —
// "Rotate pattern" mode uses per-day dropdowns instead, and a read-only
// form can't reorder anything.
function PatternDragHint() {
  return (
    <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
      <GripVerticalIcon className='size-3.5 shrink-0' />
      Drag and drop a day card to move it
    </p>
  )
}

function PatternDayGrid({
  fields,
  shiftOptions,
  cycleLengthUnit,
  disabled,
  isCustomShifts,
}: PatternDayGridProps) {
  const [openMonthIndex, setOpenMonthIndex] = useState<number | null>(null)
  const isMonthly = cycleLengthUnit === 'monthly'
  const reorder = usePatternReorder()

  // Weekly/custom-days cycles are short enough (max 7 per row) to show
  // directly.
  if (!isMonthly) {
    return (
      <div className='space-y-2'>
        {isCustomShifts && !disabled && <PatternDragHint />}
        <div className='grid grid-cols-3 gap-2 sm:grid-cols-7'>
          {fields.map((field, index) => (
            <PatternDayCard
              key={field.id}
              index={index}
              shiftOptions={shiftOptions}
              disabled={disabled}
              isCustomShifts={isCustomShifts}
              reorder={reorder}
            />
          ))}
        </div>
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
  const openMonth = openMonthIndex != null ? months[openMonthIndex] : undefined

  return (
    <>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        {months.map((month) => (
          <Button
            key={month.index}
            type='button'
            variant='outline'
            onClick={() => setOpenMonthIndex(month.index)}
            disabled={disabled}
            className='h-auto flex-col gap-0.5 px-3 py-4 text-sm'
          >
            <span className='font-medium'>Month {month.index + 1}</span>
            <span className='text-xs text-muted-foreground'>
              Days {month.start + 1}–{month.end}
            </span>
          </Button>
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
            <div className='space-y-2'>
              {isCustomShifts && !disabled && <PatternDragHint />}
              <div className='grid max-h-[65vh] grid-cols-3 gap-2 overflow-y-auto pe-1 sm:grid-cols-7'>
                {fields
                  .slice(openMonth.start, openMonth.end)
                  .map((field, i) => (
                    <PatternDayCard
                      key={field.id}
                      index={openMonth.start + i}
                      shiftOptions={shiftOptions}
                      disabled={disabled}
                      isCustomShifts={isCustomShifts}
                      reorder={reorder}
                    />
                  ))}
              </div>
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
  // "Custom alternate" only — see `PatternDayGrid`/`usePatternReorder`.
  isCustomShifts?: boolean
  reorder?: PatternReorder
}

function PatternDayCard({
  index,
  shiftOptions,
  disabled,
  isCustomShifts,
  reorder,
}: PatternDayCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const isOff = useWatch({ control, name: `pattern.${index}.is_off` })
  const shiftId = useWatch({ control, name: `pattern.${index}.shift_id` }) as
    string | undefined
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

  if (isCustomShifts && reorder) {
    const isDragging = reorder.draggingIndex === index
    const dropSide =
      reorder.dropTarget?.index === index ? reorder.dropTarget.side : null

    return (
      <Card
        draggable={!disabled}
        onDragStart={(e) => {
          // Firefox requires data to be set for the drag to start at all;
          // the actual move logic reads from `reorder` state, not this.
          e.dataTransfer.setData('text/plain', String(index))
          e.dataTransfer.effectAllowed = 'move'
          reorder.start(index)
        }}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          const rect = e.currentTarget.getBoundingClientRect()
          const side =
            e.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
          reorder.hover(index, side)
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (disabled) return
          reorder.drop()
        }}
        onDragEnd={() => reorder.end()}
        className={cn(
          'relative gap-1 py-2 transition-colors',
          !disabled && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-40'
        )}
      >
        {dropSide && (
          <span
            className={cn(
              'absolute inset-y-0 z-10 w-0.5 rounded-full bg-primary',
              dropSide === 'before' ? '-left-1.5' : '-right-1.5'
            )}
          />
        )}
        <CardContent className='flex min-h-8 items-center justify-center gap-1 px-2'>
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
          <p className='truncate text-center text-xs'>
            {assignedShift ? assignedShift.name : `Day ${index + 1}`}
          </p>
        </CardContent>
      </Card>
    )
  }

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
