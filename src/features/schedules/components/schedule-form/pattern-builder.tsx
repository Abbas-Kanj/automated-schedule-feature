import { useEffect, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/select-dropdown'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import {
  CYCLE_LENGTH_QUICK_PICKS,
  CYCLE_LENGTH_UNIT_OPTIONS,
  CYCLE_TYPE_OPTIONS,
} from '../../data/data'
import {
  type CustomShiftCount,
  type RotatePatternEntry,
} from '../../data/schema'
import { DateField } from './date-field'
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
  const days = cycleLength?.days ?? 0

  const { fields, replace } = useFieldArray({ control, name: 'pattern' })

  useEffect(() => {
    if (!days) return
    const current =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    if (current.length === days) return
    const next = Array.from(
      { length: days },
      (_, i) => current[i] ?? { position: i + 1, is_off: true, shift_id: undefined }
    )
    replace(next)
  }, [days])

  // Every day's dropdown picks from the shifts selected back in the
  // "Shifts" step — no more hand-authored blocks (see `data/schema.ts`).
  const shiftOptions = shiftIds
    .map((id) => shifts.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => ({ value: s.id, label: s.name }))

  const applyCountsToDays = (counts: CustomShiftCount[]) => {
    if (!days) return
    const next: RotatePatternEntry[] = []
    let position = 1
    for (const c of counts) {
      for (let i = 0; i < c.count && position <= days; i++, position++) {
        next.push({ position, is_off: false, shift_id: c.shift_id })
      }
    }
    while (position <= days) {
      next.push({ position, is_off: true, shift_id: undefined })
      position++
    }
    setValue('pattern', next, { shouldValidate: true, shouldDirty: true })
  }

  return (
    <div className='space-y-4'>
      <FormField
        control={control}
        name='start_date'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Start date</FormLabel>
            <FormControl>
              <DateField
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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
                  onValueChange={field.onChange}
                  placeholder='Select a unit'
                  items={CYCLE_LENGTH_UNIT_OPTIONS}
                  disabled={disabled}
                />
                <FormMessage />
              </FormItem>
            )}
          />

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
        </CardContent>
      </Card>

      <FormField
        control={control}
        name='shift_length_hours'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Shift length (hours per day)</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                max={24}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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

          {!days ? (
            <p className='text-sm text-muted-foreground'>
              Set the cycle length to build the pattern.
            </p>
          ) : !shiftOptions.length ? (
            <p className='text-sm text-muted-foreground'>
              Pick shifts in the previous step to assign them to days.
            </p>
          ) : (
            <>
              {cycleType === 'custom_shifts' && (
                <CustomShiftCounts
                  shiftIds={shiftIds}
                  days={days}
                  disabled={disabled}
                  onApply={applyCountsToDays}
                />
              )}
              <PatternDayGrid
                fields={fields}
                shiftOptions={shiftOptions}
                cycleLengthUnit={cycleLength?.unit}
                disabled={disabled}
              />
            </>
          )}
          <DirectionPreview />
        </CardContent>
      </Card>
    </div>
  )
}

type CustomShiftCountsProps = {
  shiftIds: string[]
  days: number
  disabled?: boolean
  onApply: (counts: CustomShiftCount[]) => void
}

function CustomShiftCounts({
  shiftIds,
  days,
  disabled,
  onApply,
}: CustomShiftCountsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues, formState } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const { fields, replace } = useFieldArray({
    control,
    name: 'custom_shift_counts',
  })

  // Keep one count row per currently-selected shift, in `shift_ids` order —
  // adding/removing a shift in the previous step should add/drop its row
  // here rather than leaving stale entries behind.
  const shiftIdsKey = shiftIds.join(',')
  useEffect(() => {
    const current =
      (getValues('custom_shift_counts') as CustomShiftCount[] | undefined) ??
      []
    const next = shiftIds.map(
      (id) => current.find((c) => c.shift_id === id) ?? { shift_id: id, count: 0 }
    )
    const changed =
      next.length !== current.length ||
      next.some((c, i) => c.shift_id !== current[i]?.shift_id)
    if (changed) replace(next)
  }, [shiftIdsKey])

  const counts = (useWatch({ control, name: 'custom_shift_counts' }) as
    | CustomShiftCount[]
    | undefined) ?? []
  const totalAssigned = counts.reduce((sum, c) => sum + (c.count || 0), 0)
  const countsError = formState.errors?.custom_shift_counts as
    | { message?: string; root?: { message?: string } }
    | undefined

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-sm font-medium'>Shift counts</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 px-4'>
        {(fields as (CustomShiftCount & { id: string })[]).map(
          (field, index) => {
            const shift = shifts.find((s) => s.id === field.shift_id)
            return (
              <FormField
                key={field.id}
                control={control}
                name={`custom_shift_counts.${index}.count`}
                render={({ field: countField }) => (
                  <FormItem className='flex items-center justify-between gap-4 space-y-0'>
                    <FormLabel className='font-normal'>
                      {shift?.name ?? 'Shift'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        className='w-24'
                        disabled={disabled}
                        value={countField.value ?? 0}
                        onChange={(e) =>
                          countField.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )
          }
        )}

        <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-3'>
          <p
            className={cn(
              'text-sm',
              totalAssigned > days ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {totalAssigned} / {days} day(s) assigned
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || !days}
            onClick={() => onApply(counts)}
          >
            Apply to days
          </Button>
        </div>
        {(countsError?.message || countsError?.root?.message) && (
          <p className='text-sm font-medium text-destructive'>
            {countsError.message ?? countsError.root?.message}
          </p>
        )}
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

function PatternDayGrid({
  fields,
  shiftOptions,
  cycleLengthUnit,
  disabled,
}: PatternDayGridProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const isMonthly = cycleLengthUnit === 'monthly'

  const grid = (
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

  // Monthly cycles can run 28-31+ days — too many cards to show inline, so
  // they're tucked behind a summary that opens the same grid in a modal.
  // Weekly/custom-days cycles are short enough (max 7 per row) to show
  // directly.
  if (!isMonthly) return grid

  return (
    <>
      <button
        type='button'
        onClick={() => setModalOpen(true)}
        disabled={disabled}
        className='flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60'
      >
        <span>Configure {fields.length} day(s)</span>
        <span className='text-muted-foreground'>Tap to open</span>
      </button>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Configure days</DialogTitle>
          </DialogHeader>
          <div className='max-h-[65vh] overflow-y-auto pe-1'>{grid}</div>
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
  const isOff = useWatch({ control, name: `pattern.${index}.is_off` })
  const shiftId = useWatch({ control, name: `pattern.${index}.shift_id` }) as
    | string
    | undefined
  const value = !isOff && shiftId ? shiftId : 'off'
  const items = [{ value: 'off', label: 'Off' }, ...shiftOptions]

  return (
    <Card className='gap-1 py-2'>
      <CardContent className='space-y-1 px-2'>
        <p className='text-center text-xs text-muted-foreground'>
          Day {index + 1}
        </p>
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
