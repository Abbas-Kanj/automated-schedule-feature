import { Copy, Plus, X } from 'lucide-react'
import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { BREAK_TYPE_OPTIONS, DAY_LABELS } from '../../data/data'
import {
  type BreakEntry,
  type BreakType,
  dayTimesCollide,
  type DayOfWeek,
  type DayTimeEntry,
  type ShiftFormValues,
  type ShiftHoursMode,
  type TimeRangeEntry,
} from '../../data/schema'
import {
  calculateShiftHours,
  formatDurationHours,
  getBreakSpanMinutes,
} from '../../utils'
import { IconPickerField } from './icon-picker-field'

const DEFAULT_TIME: TimeRangeEntry = {
  from_time: '09:00',
  to_time: '17:00',
  overnight: false,
}

const DEFAULT_BREAK: BreakEntry = {
  from_time: '12:00',
  to_time: '12:30',
  duration_minutes: undefined,
  name: '',
  icon: 'coffee',
}

// "Shift times" tab of `ShiftFormDialog` — hours mode, per-day time ranges
// and break time, all inline in the tab (this used to live behind a
// click-to-open "Edit hours" dialog inside `GeneralTab`; now every change
// writes straight to the form, same as any other field on this form).
export function ShiftTimesTab() {
  const form = useFormContext<ShiftFormValues>()

  const mode = useWatch({ control: form.control, name: 'hours_mode' })
  const days = useWatch({ control: form.control, name: 'days' }) ?? []
  const breakType = useWatch({ control: form.control, name: 'break_type' })
  const breaks = useWatch({ control: form.control, name: 'breaks' }) ?? []
  const category = useWatch({ control: form.control, name: 'category' })

  // The "Overnight" category implies every time range on this shift
  // crosses midnight — see the "Check next day" indicator on the General
  // tab, right under the Category field. This only ever forces `overnight`
  // *on*; picking a different category never forces it back off, so a
  // shift under e.g. the "Night" category that was set up to cross
  // midnight some other way keeps working.
  const isOvernightCategory = category === 'overnight'

  const firstEnabled = days.find((d) => d.enabled)
  const master: TimeRangeEntry = firstEnabled?.times[0] ?? defaultTime()

  const setDays = (next: DayTimeEntry[]) =>
    form.setValue('days', next, { shouldValidate: true, shouldDirty: true })

  // A brand-new time range, seeded as overnight when the category already
  // calls for it.
  function defaultTime(): TimeRangeEntry {
    return { ...DEFAULT_TIME, overnight: isOvernightCategory }
  }

  // Reshapes `days` for the new mode: 'same' collapses every enabled day
  // onto the first enabled day's range, 'different' just keeps each day's
  // existing ranges (seeding an empty one with that same shared range).
  const switchMode = (nextMode: ShiftHoursMode) => {
    const nextMaster: TimeRangeEntry = firstEnabled?.times[0]
      ? { ...firstEnabled.times[0] }
      : defaultTime()
    form.setValue('hours_mode', nextMode, { shouldDirty: true })
    setDays(
      days.map((d) => ({
        ...d,
        times:
          nextMode === 'same' && d.enabled
            ? [{ ...nextMaster }]
            : d.times.length
              ? d.times.map((t) => ({ ...t }))
              : [defaultTime()],
      }))
    )
  }

  // Retroactively flips every existing range's `overnight` on the moment
  // the category becomes "Overnight" (e.g. picked after hours were already
  // set up) — never runs the other direction.
  useEffect(() => {
    if (!isOvernightCategory) return
    if (days.every((d) => d.times.every((t) => t.overnight))) return
    setDays(
      days.map((d) => ({
        ...d,
        times: d.times.map((t) => (t.overnight ? t : { ...t, overnight: true })),
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOvernightCategory])

  const updateMaster = (patch: Partial<TimeRangeEntry>) => {
    const next = { ...master, ...patch }
    setDays(days.map((d) => (d.enabled ? { ...d, times: [{ ...next }] } : d)))
  }

  const toggleDay = (day: DayOfWeek) => {
    setDays(
      days.map((d) => {
        if (d.day !== day) return d
        if (d.enabled) return { ...d, enabled: false }
        if (mode === 'same') {
          return { ...d, enabled: true, times: [{ ...master }] }
        }
        return {
          ...d,
          enabled: true,
          times: d.times.length ? d.times : [defaultTime()],
        }
      })
    )
  }

  const addTimeToDay = (day: DayOfWeek) =>
    setDays(
      days.map((d) =>
        d.day === day ? { ...d, times: [...d.times, defaultTime()] } : d
      )
    )

  const removeTimeFromDay = (day: DayOfWeek, index: number) =>
    setDays(
      days.map((d) =>
        d.day === day
          ? {
              ...d,
              times:
                d.times.length > 1
                  ? d.times.filter((_, i) => i !== index)
                  : d.times,
            }
          : d
      )
    )

  const updateTimeInDay = (
    day: DayOfWeek,
    index: number,
    patch: Partial<TimeRangeEntry>
  ) =>
    setDays(
      days.map((d) =>
        d.day === day
          ? {
              ...d,
              times: d.times.map((t, i) =>
                i === index ? { ...t, ...patch } : t
              ),
            }
          : d
      )
    )

  // Copies this day's time ranges onto every other day — reuse a fully
  // set-up day instead of re-entering the same ranges one by one.
  const copyDayToAll = (day: DayOfWeek) => {
    const source = days.find((d) => d.day === day)
    if (!source) return
    setDays(
      days.map((d) =>
        d.day === day ? d : { ...d, times: source.times.map((t) => ({ ...t })) }
      )
    )
  }

  const setBreaks = (next: BreakEntry[]) =>
    form.setValue('breaks', next, { shouldValidate: true, shouldDirty: true })

  const toggleBreakEnabled = (checked: boolean) => {
    form.setValue('break_enabled', checked, { shouldDirty: true })
    if (checked && breaks.length === 0) setBreaks([{ ...DEFAULT_BREAK }])
  }

  const addBreak = () => setBreaks([...breaks, { ...DEFAULT_BREAK }])

  const removeBreak = (index: number) =>
    setBreaks(breaks.filter((_, i) => i !== index))

  const updateBreak = (index: number, patch: Partial<BreakEntry>) =>
    setBreaks(
      breaks.map((entry, i) => {
        if (i !== index) return entry
        const next = { ...entry, ...patch }
        // A duration entered for the old range can outlive a narrower new
        // one — drop it rather than silently saving an out-of-range value.
        if ('from_time' in patch || 'to_time' in patch) {
          const span = getBreakSpanMinutes(next.from_time, next.to_time)
          if (next.duration_minutes && next.duration_minutes > span) {
            next.duration_minutes = undefined
          }
        }
        return next
      })
    )

  const isTimeValid = (t: TimeRangeEntry) => t.overnight || t.to_time > t.from_time
  const isDayValid = (d: DayTimeEntry) =>
    !d.enabled ||
    (d.times.length > 0 &&
      d.times.every(isTimeValid) &&
      !dayTimesCollide(d.times))
  const anyEnabled = days.some((d) => d.enabled)
  const allValid = days.every(isDayValid)
  const masterValid = master.overnight || master.to_time > master.from_time
  const masterDuration = calculateShiftHours(master.from_time, master.to_time)

  // Mirrors the schema's `superRefine` break checks, for live feedback
  // without waiting on a submit/validate cycle.
  const getBreakEntryError = (b: BreakEntry): string | null => {
    if (!(b.to_time > b.from_time)) return 'End time must be after start time.'
    if (breakType !== 'paid') return null
    if (!b.duration_minutes) return 'Enter a break duration.'
    if (b.duration_minutes > getBreakSpanMinutes(b.from_time, b.to_time)) {
      return "Duration can't be longer than the from–to range."
    }
    return null
  }

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='hours_mode'
        render={() => (
          <FormItem>
            <FormLabel>Hours</FormLabel>
            <FormControl>
              <RadioGroup
                value={mode}
                onValueChange={(value) => switchMode(value as ShiftHoursMode)}
                className='gap-2'
              >
                {/*
                  Radix's RadioGroupItem renders a hidden native radio input
                  for native-form compatibility, and whenever its checked
                  state changes for ANY reason — including `switchMode`
                  flipping `mode` here — it dispatches a synthetic
                  (untrusted) bubbling `click` on that hidden input. That
                  event bubbles into these labels and would otherwise
                  re-trigger this same onClick, calling `switchMode` again
                  on the *other* option, flipping `mode` back, which
                  dispatches another synthetic click, and so on —
                  cascading into an infinite update loop that crashes the
                  page. The `isTrusted` guard filters out Radix's own
                  re-dispatch; real user clicks are always trusted. See
                  `radix-radio-group-bubble-input-reopens-dialog` (global
                  skill) — this is the same landmine, just a crash instead
                  of a reopened dialog since there's no dialog here.
                */}
                <Label
                  onClick={(event) => {
                    if (event.nativeEvent.isTrusted && mode !== 'same') {
                      switchMode('same')
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal',
                    mode === 'same' && 'border-primary bg-primary/5'
                  )}
                >
                  <RadioGroupItem value='same' />
                  Same hours every day
                </Label>
                <Label
                  onClick={(event) => {
                    if (event.nativeEvent.isTrusted && mode !== 'different') {
                      switchMode('different')
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal',
                    mode === 'different' && 'border-primary bg-primary/5'
                  )}
                >
                  <RadioGroupItem value='different' />
                  Different hours every day
                </Label>
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      {mode === 'same' && (
        <div className='space-y-3 rounded-md border p-3'>
          <div className='flex items-start gap-2'>
            <div className='flex-1 space-y-1'>
              <Label>From</Label>
              <Input
                type='time'
                value={master.from_time}
                onChange={(e) => updateMaster({ from_time: e.target.value })}
              />
            </div>
            <div className='flex-1 space-y-1'>
              <Label>To</Label>
              <Input
                type='time'
                value={master.to_time}
                onChange={(e) => updateMaster({ to_time: e.target.value })}
              />
            </div>
            <div className='flex-1 space-y-1'>
              <Label>Duration</Label>
              <Input
                disabled
                readOnly
                value={masterValid ? formatDurationHours(masterDuration) : '—'}
              />
            </div>
          </div>
          {!masterValid && (
            <p className='text-destructive text-sm'>
              End time must be after start time.
            </p>
          )}
        </div>
      )}

      <div className='space-y-1.5'>
        {days.map((d) => {
          const dayCollides =
            mode === 'different' && d.enabled && dayTimesCollide(d.times)
          return (
            <div
              key={d.day}
              className={cn(
                'flex items-start gap-3 rounded-md border p-2',
                !d.enabled && 'opacity-60'
              )}
            >
              <div className='flex w-28 shrink-0 items-center gap-2 pt-1.5'>
                <Switch
                  checked={d.enabled}
                  onCheckedChange={() => toggleDay(d.day)}
                  aria-label={`Toggle ${DAY_LABELS[d.day]}`}
                />
                <span className='text-sm font-medium'>{DAY_LABELS[d.day]}</span>
              </div>

              {mode === 'different' && (
                <div className='flex-1 space-y-1.5 pt-1.5'>
                  {!d.enabled ? (
                    <span className='text-muted-foreground text-sm'>
                      Not available
                    </span>
                  ) : (
                    <>
                      {d.times.map((t, i) => (
                        <div
                          key={i}
                          className='flex flex-wrap items-center gap-1.5'
                        >
                          <Input
                            type='time'
                            className='h-8 w-auto flex-1'
                            value={t.from_time}
                            onChange={(e) =>
                              updateTimeInDay(d.day, i, {
                                from_time: e.target.value,
                              })
                            }
                          />
                          <span className='text-muted-foreground text-xs'>
                            to
                          </span>
                          <Input
                            type='time'
                            className='h-8 w-auto flex-1'
                            value={t.to_time}
                            onChange={(e) =>
                              updateTimeInDay(d.day, i, {
                                to_time: e.target.value,
                              })
                            }
                          />
                          <span className='text-muted-foreground text-xs whitespace-nowrap'>
                            {isTimeValid(t)
                              ? formatDurationHours(
                                  calculateShiftHours(t.from_time, t.to_time)
                                )
                              : '—'}
                          </span>
                          {i === 0 ? (
                            <div className='ms-auto flex items-center gap-0.5'>
                              <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                className='size-7'
                                onClick={() => addTimeToDay(d.day)}
                                aria-label='Add another time range'
                              >
                                <Plus className='size-4' />
                              </Button>
                              <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                className='size-7'
                                onClick={() => copyDayToAll(d.day)}
                                aria-label='Copy to all days'
                              >
                                <Copy className='size-3.5' />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='ms-auto size-7'
                              onClick={() => removeTimeFromDay(d.day, i)}
                              aria-label='Remove time range'
                            >
                              <X className='size-4' />
                            </Button>
                          )}
                        </div>
                      ))}
                      {dayCollides && (
                        <p className='text-destructive text-xs'>
                          These times overlap — adjust them so they
                          don&apos;t collide.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!anyEnabled && (
        <p className='text-destructive text-sm'>Select at least one day.</p>
      )}
      {anyEnabled && !allValid && (
        <p className='text-destructive text-sm'>
          Every selected day needs valid, non-overlapping time ranges (end
          after start).
        </p>
      )}

      <FormField
        control={form.control}
        name='break_enabled'
        render={({ field }) => (
          <FormItem className='space-y-3 rounded-md border p-3'>
            <Label className='flex cursor-pointer items-center justify-between font-normal'>
              Break time
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={toggleBreakEnabled}
                />
              </FormControl>
            </Label>

            {field.value && (
              <>
                <RadioGroup
                  value={breakType}
                  onValueChange={(v) =>
                    form.setValue('break_type', v as BreakType, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className='flex gap-4'
                >
                  {BREAK_TYPE_OPTIONS.map((option) => (
                    <Label
                      key={option.value}
                      className='flex cursor-pointer items-center gap-1.5 font-normal'
                    >
                      <RadioGroupItem value={option.value} />
                      {option.label}
                    </Label>
                  ))}
                </RadioGroup>
                {!breakType && (
                  <p className='text-destructive text-sm'>
                    Select a break type.
                  </p>
                )}

                <div className='space-y-2'>
                  {breaks.map((b, i) => {
                    const span = getBreakSpanMinutes(b.from_time, b.to_time)
                    const error = getBreakEntryError(b)
                    return (
                      <div key={i} className='space-y-1.5 rounded-md border p-2'>
                        <div className='flex items-start gap-2'>
                          <div className='flex-1 space-y-1'>
                            <Label className='text-xs'>Name</Label>
                            <Input
                              placeholder='e.g. Lunch break'
                              className='h-8'
                              value={b.name ?? ''}
                              onChange={(e) =>
                                updateBreak(i, { name: e.target.value })
                              }
                            />
                          </div>
                          <div className='space-y-1'>
                            <Label className='text-xs'>Icon</Label>
                            <IconPickerField
                              value={b.icon}
                              onChange={(value) => updateBreak(i, { icon: value })}
                            />
                          </div>
                        </div>
                        <div className='flex items-start gap-2'>
                          <div className='flex-1 space-y-1'>
                            <Label className='text-xs'>From</Label>
                            <Input
                              type='time'
                              className='h-8'
                              value={b.from_time}
                              onChange={(e) =>
                                updateBreak(i, { from_time: e.target.value })
                              }
                            />
                          </div>
                          <div className='flex-1 space-y-1'>
                            <Label className='text-xs'>To</Label>
                            <Input
                              type='time'
                              className='h-8'
                              value={b.to_time}
                              onChange={(e) =>
                                updateBreak(i, { to_time: e.target.value })
                              }
                            />
                          </div>
                          <div className='flex-1 space-y-1'>
                            <Label className='text-xs'>Duration (min)</Label>
                            <Input
                              type='number'
                              min={1}
                              max={span || undefined}
                              className='h-8'
                              placeholder='Minutes'
                              disabled={breakType === 'unpaid'}
                              value={b.duration_minutes ?? ''}
                              onChange={(e) =>
                                updateBreak(i, {
                                  duration_minutes: Number.isNaN(
                                    e.target.valueAsNumber
                                  )
                                    ? undefined
                                    : e.target.valueAsNumber,
                                })
                              }
                            />
                          </div>
                          {breaks.length > 1 && (
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='mt-5'
                              onClick={() => removeBreak(i)}
                              aria-label='Remove break'
                            >
                              <X className='size-4' />
                            </Button>
                          )}
                        </div>
                        {error && (
                          <p className='text-destructive text-sm'>{error}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='w-full'
                  onClick={addBreak}
                >
                  <Plus className='size-4' /> Add break
                </Button>
              </>
            )}
          </FormItem>
        )}
      />
    </div>
  )
}
