import { useState } from 'react'
import { Copy, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { BREAK_TYPE_OPTIONS, DAY_LABELS } from '../../data/data'
import {
  type BreakEntry,
  type BreakType,
  dayTimesCollide,
  type DayOfWeek,
  type DayTimeEntry,
  type ShiftHoursMode,
  type TimeRangeEntry,
} from '../../data/schema'
import { getBreakDurationOptions } from '../../utils'

type MasterTime = TimeRangeEntry

const DEFAULT_TIME: MasterTime = {
  from_time: '09:00',
  to_time: '17:00',
  overnight: false,
}

const DEFAULT_BREAK: BreakEntry = {
  from_time: '12:00',
  to_time: '12:30',
  duration_minutes: undefined,
}

type ShiftHoursFieldProps = {
  mode: ShiftHoursMode
  days: DayTimeEntry[]
  breakEnabled: boolean
  breakType: BreakType | undefined
  breaks: BreakEntry[]
  onSave: (value: {
    mode: ShiftHoursMode
    days: DayTimeEntry[]
    breakEnabled: boolean
    breakType: BreakType | undefined
    breaks: BreakEntry[]
  }) => void
  disabled?: boolean
  error?: string
}

export function ShiftHoursField({
  mode,
  days,
  breakEnabled,
  breakType,
  breaks,
  onSave,
  disabled,
  error,
}: ShiftHoursFieldProps) {
  const [open, setOpen] = useState(false)
  const [draftMode, setDraftMode] = useState<ShiftHoursMode>(mode)
  const [master, setMaster] = useState<MasterTime>(DEFAULT_TIME)
  const [draftDays, setDraftDays] = useState<DayTimeEntry[]>(days)
  const [draftBreakEnabled, setDraftBreakEnabled] = useState(breakEnabled)
  const [draftBreakType, setDraftBreakType] = useState<BreakType | undefined>(
    breakType
  )
  const [draftBreaks, setDraftBreaks] = useState<BreakEntry[]>(breaks)

  const openDialogFor = (nextMode: ShiftHoursMode) => {
    const firstEnabled = days.find((d) => d.enabled)
    const nextMaster: MasterTime = firstEnabled?.times[0]
      ? { ...firstEnabled.times[0] }
      : DEFAULT_TIME
    setDraftMode(nextMode)
    setMaster(nextMaster)
    setDraftDays(
      days.map((d) => ({
        ...d,
        times:
          nextMode === 'same' && d.enabled
            ? [{ ...nextMaster }]
            : d.times.length
              ? d.times.map((t) => ({ ...t }))
              : [{ ...DEFAULT_TIME }],
      }))
    )
    setDraftBreakEnabled(breakEnabled)
    setDraftBreakType(breakType)
    setDraftBreaks(breaks.length ? breaks.map((b) => ({ ...b })) : [])
    setOpen(true)
  }

  const toggleDay = (day: DayOfWeek) => {
    setDraftDays((prev) =>
      prev.map((d) => {
        if (d.day !== day) return d
        if (d.enabled) return { ...d, enabled: false }
        if (draftMode === 'same') {
          return { ...d, enabled: true, times: [{ ...master }] }
        }
        return {
          ...d,
          enabled: true,
          times: d.times.length ? d.times : [{ ...DEFAULT_TIME }],
        }
      })
    )
  }

  const updateMaster = (patch: Partial<MasterTime>) => {
    const next = { ...master, ...patch }
    setMaster(next)
    setDraftDays((prev) =>
      prev.map((d) => (d.enabled ? { ...d, times: [{ ...next }] } : d))
    )
  }

  const addTimeToDay = (day: DayOfWeek) =>
    setDraftDays((prev) =>
      prev.map((d) =>
        d.day === day ? { ...d, times: [...d.times, { ...DEFAULT_TIME }] } : d
      )
    )

  const removeTimeFromDay = (day: DayOfWeek, index: number) =>
    setDraftDays((prev) =>
      prev.map((d) =>
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
    setDraftDays((prev) =>
      prev.map((d) =>
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
  const copyDayToAll = (day: DayOfWeek) =>
    setDraftDays((prev) => {
      const source = prev.find((d) => d.day === day)
      if (!source) return prev
      return prev.map((d) =>
        d.day === day
          ? d
          : { ...d, times: source.times.map((t) => ({ ...t })) }
      )
    })

  const toggleBreakEnabled = (checked: boolean) => {
    setDraftBreakEnabled(checked)
    if (checked && draftBreaks.length === 0) {
      setDraftBreaks([{ ...DEFAULT_BREAK }])
    }
  }

  const addBreak = () => setDraftBreaks((b) => [...b, { ...DEFAULT_BREAK }])

  const removeBreak = (index: number) =>
    setDraftBreaks((b) => b.filter((_, i) => i !== index))

  const updateBreak = (index: number, patch: Partial<BreakEntry>) =>
    setDraftBreaks((b) =>
      b.map((entry, i) => {
        if (i !== index) return entry
        const next = { ...entry, ...patch }
        // A duration picked for the old range can outlive a narrower new
        // one — drop it rather than silently saving an out-of-range value.
        if ('from_time' in patch || 'to_time' in patch) {
          const options = getBreakDurationOptions(next.from_time, next.to_time)
          if (
            next.duration_minutes &&
            !options.includes(next.duration_minutes)
          ) {
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
  const anyEnabled = draftDays.some((d) => d.enabled)
  const allValid = draftDays.every(isDayValid)
  const masterValid = master.overnight || master.to_time > master.from_time
  const hoursValid =
    anyEnabled && allValid && (draftMode === 'different' || masterValid)

  const isBreakEntryValid = (b: BreakEntry) =>
    b.to_time > b.from_time &&
    (draftBreakType !== 'paid' || !!b.duration_minutes)
  const breaksValid =
    !draftBreakEnabled ||
    (!!draftBreakType && draftBreaks.length > 0 && draftBreaks.every(isBreakEntryValid))

  const canSave = hoursValid && breaksValid

  const save = () => {
    onSave({
      mode: draftMode,
      days: draftDays,
      breakEnabled: draftBreakEnabled,
      breakType: draftBreakType,
      breaks: draftBreakEnabled ? draftBreaks : [],
    })
    setOpen(false)
  }

  const enabledDays = days.filter((d) => d.enabled)

  return (
    <div className='space-y-3'>
      <RadioGroup
        value={mode}
        onValueChange={(value) => openDialogFor(value as ShiftHoursMode)}
        disabled={disabled}
        className='gap-2'
      >
        {/*
          Radix's RadioGroup only fires onValueChange when the value
          actually changes, so re-clicking the already-selected option
          (the common case, since 'same' is the default) would otherwise
          never reopen its dialog. Each label calls openDialogFor directly
          on click so it always opens, regardless of whether the value
          changed.

          The `isTrusted` guard matters: Radix's RadioGroupItem renders a
          hidden native radio input for native-form compatibility, and
          whenever its checked state changes for ANY reason — including
          this component's own `mode` prop flipping after Save — it
          dispatches a synthetic (untrusted) bubbling `click` event on that
          hidden input to notify native listeners. That event bubbles into
          this very label and would otherwise re-trigger openDialogFor,
          reopening the dialog immediately after Save just closed it.
          Real user clicks are always `isTrusted`, so this only filters out
          Radix's own re-dispatch.
        */}
        <Label
          onClick={(event) => {
            if (event.nativeEvent.isTrusted) openDialogFor('same')
          }}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal',
            mode === 'same' && 'border-primary bg-primary/5',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <RadioGroupItem value='same' />
          Same hours every day
        </Label>
        <Label
          onClick={(event) => {
            if (event.nativeEvent.isTrusted) openDialogFor('different')
          }}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal',
            mode === 'different' && 'border-primary bg-primary/5',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <RadioGroupItem value='different' />
          Different hours every day
        </Label>
      </RadioGroup>

      <div className='flex flex-wrap items-center gap-1.5'>
        {enabledDays.length ? (
          enabledDays.map((d) => {
            const [first, ...rest] = d.times
            return (
              <span
                key={d.day}
                className='bg-muted rounded-md px-2 py-1 text-xs'
              >
                {DAY_LABELS[d.day]}{' '}
                {first
                  ? `${first.from_time}–${first.to_time}${first.overnight ? ' (+1d)' : ''}`
                  : '—'}
                {rest.length > 0 && ` +${rest.length}`}
              </span>
            )
          })
        ) : (
          <span className='text-muted-foreground text-xs'>
            No days selected yet
          </span>
        )}
        {breakEnabled &&
          breaks.map((b, i) => (
            <span
              key={i}
              className='rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400'
            >
              Break {b.from_time}–{b.to_time}
              {b.duration_minutes && ` · ${b.duration_minutes}m`}
            </span>
          ))}
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled}
          onClick={() => openDialogFor(mode)}
        >
          Edit hours
        </Button>
      </div>
      {error && <p className='text-destructive text-sm'>{error}</p>}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader className='text-start'>
            <DialogTitle>
              {draftMode === 'same'
                ? 'Same hours every day'
                : 'Different hours every day'}
            </DialogTitle>
            <DialogDescription>
              {draftMode === 'same'
                ? 'Set one time range, then toggle which days use it.'
                : 'Toggle each day on and give it one or more time ranges.'}
            </DialogDescription>
          </DialogHeader>

          <div className='max-h-105 space-y-3 overflow-y-auto py-1'>
            {draftMode === 'same' && (
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-start gap-2'>
                  <div className='flex-1 space-y-1'>
                    <Label>From</Label>
                    <Input
                      type='time'
                      value={master.from_time}
                      onChange={(e) =>
                        updateMaster({ from_time: e.target.value })
                      }
                    />
                  </div>
                  <div className='flex-1 space-y-1'>
                    <Label>To</Label>
                    <Input
                      type='time'
                      value={master.to_time}
                      onChange={(e) =>
                        updateMaster({ to_time: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Label className='flex cursor-pointer items-center justify-between font-normal'>
                  Ends the next day (overnight)
                  <Switch
                    checked={master.overnight}
                    onCheckedChange={(checked) =>
                      updateMaster({ overnight: checked })
                    }
                  />
                </Label>
                {!masterValid && (
                  <p className='text-destructive text-sm'>
                    End time must be after start time (or mark as overnight).
                  </p>
                )}
              </div>
            )}

            <div className='space-y-1.5'>
              {draftDays.map((d) => {
                const dayCollides =
                  draftMode === 'different' &&
                  d.enabled &&
                  dayTimesCollide(d.times)
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
                      <span className='text-sm font-medium'>
                        {DAY_LABELS[d.day]}
                      </span>
                    </div>

                    <div className='flex-1 space-y-1.5 pt-1.5'>
                      {!d.enabled ? (
                        <span className='text-muted-foreground text-sm'>
                          Not available
                        </span>
                      ) : draftMode === 'same' ? (
                        <span className='text-muted-foreground text-sm'>
                          {master.from_time} to {master.to_time}
                          {master.overnight ? ' (+1d)' : ''}
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
                              <Label className='text-muted-foreground flex cursor-pointer items-center gap-1 text-xs font-normal'>
                                <Switch
                                  checked={t.overnight}
                                  onCheckedChange={(checked) =>
                                    updateTimeInDay(d.day, i, {
                                      overnight: checked,
                                    })
                                  }
                                />
                                +1d
                              </Label>
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
                  </div>
                )
              })}
            </div>

            {!anyEnabled && (
              <p className='text-destructive text-sm'>
                Select at least one day.
              </p>
            )}
            {anyEnabled && !allValid && (
              <p className='text-destructive text-sm'>
                Every selected day needs valid, non-overlapping time ranges
                (end after start, or marked overnight).
              </p>
            )}

            <div className='space-y-3 rounded-md border p-3'>
              <Label className='flex cursor-pointer items-center justify-between font-normal'>
                Break time
                <Switch
                  checked={draftBreakEnabled}
                  onCheckedChange={toggleBreakEnabled}
                />
              </Label>

              {draftBreakEnabled && (
                <>
                  <RadioGroup
                    value={draftBreakType}
                    onValueChange={(v) => setDraftBreakType(v as BreakType)}
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
                  {!draftBreakType && (
                    <p className='text-destructive text-sm'>
                      Select a break type.
                    </p>
                  )}

                  <div className='space-y-2'>
                    {draftBreaks.map((b, i) => {
                      const durationOptions = getBreakDurationOptions(
                        b.from_time,
                        b.to_time
                      )
                      const valid = isBreakEntryValid(b)
                      return (
                        <div
                          key={i}
                          className='space-y-1.5 rounded-md border p-2'
                        >
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
                              <Label className='text-xs'>Break time</Label>
                              <Select
                                value={
                                  b.duration_minutes
                                    ? String(b.duration_minutes)
                                    : undefined
                                }
                                onValueChange={(v) =>
                                  updateBreak(i, {
                                    duration_minutes: Number(v),
                                  })
                                }
                                disabled={draftBreakType === 'unpaid'}
                              >
                                <SelectTrigger className='h-8 w-full'>
                                  <SelectValue placeholder='Duration' />
                                </SelectTrigger>
                                <SelectContent>
                                  {durationOptions.length ? (
                                    durationOptions.map((minutes) => (
                                      <SelectItem
                                        key={minutes}
                                        value={String(minutes)}
                                      >
                                        {minutes} min
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value='none' disabled>
                                      Widen the range first
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            {draftBreaks.length > 1 && (
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
                          {!valid && (
                            <p className='text-destructive text-sm'>
                              {b.to_time > b.from_time
                                ? 'Select a break duration.'
                                : 'End time must be after start time.'}
                            </p>
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
            </div>
          </div>

          <DialogFooter>
            <Button type='button' disabled={!canSave} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
