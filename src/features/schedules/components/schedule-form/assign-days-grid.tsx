import { useState } from 'react'
import { useFieldArray, useFormContext, useFormState } from 'react-hook-form'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type RegularShiftTimeEntry,
  shiftTimesCollide,
} from '../../data/schema'
import { calculateHours } from '../../utils'

const DEFAULT_TIME: RegularShiftTimeEntry = { from_time: '09:00', to_time: '17:00' }

type AssignDaysGridProps = {
  shiftIndex: number
  disabled?: boolean
}

export function AssignDaysGrid({ shiftIndex, disabled }: AssignDaysGridProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const name = `shifts.${shiftIndex}.days`
  const { fields, append, remove, update } = useFieldArray({ control, name })
  const { errors } = useFormState({ control, name })
  const daysError = (
    errors?.shifts as
      | { [key: number]: { days?: { message?: string } } }
      | undefined
  )?.[shiftIndex]?.days?.message

  const [openDay, setOpenDay] = useState<DayOfWeek | null>(null)
  const [draft, setDraft] = useState<RegularShiftTimeEntry[]>([DEFAULT_TIME])

  const findIndex = (day: DayOfWeek) =>
    fields.findIndex((f) => (f as unknown as { day: DayOfWeek }).day === day)

  const openDialogFor = (day: DayOfWeek) => {
    if (disabled) return
    const idx = findIndex(day)
    const existing =
      idx > -1
        ? (fields[idx] as unknown as { times: RegularShiftTimeEntry[] }).times
        : undefined
    setDraft(existing?.length ? existing.map((t) => ({ ...t })) : [DEFAULT_TIME])
    setOpenDay(day)
  }

  const addTime = () => setDraft((d) => [...d, { ...DEFAULT_TIME }])

  const removeTime = (index: number) =>
    setDraft((d) => (d.length > 1 ? d.filter((_, i) => i !== index) : d))

  const updateTime = (index: number, patch: Partial<RegularShiftTimeEntry>) =>
    setDraft((d) => d.map((t, i) => (i === index ? { ...t, ...patch } : t)))

  const save = () => {
    if (!openDay) return
    const idx = findIndex(openDay)
    if (idx > -1) {
      update(idx, { day: openDay, times: draft })
    } else {
      append({ day: openDay, times: draft })
    }
    setOpenDay(null)
  }

  const removeDay = () => {
    if (!openDay) return
    const idx = findIndex(openDay)
    if (idx > -1) remove(idx)
    setOpenDay(null)
  }

  const isEntryValid = (t: RegularShiftTimeEntry) =>
    !!t.from_time && !!t.to_time && (t.overnight || t.to_time > t.from_time)
  const allEntriesValid = draft.every(isEntryValid)
  const collides = allEntriesValid && shiftTimesCollide(draft)
  const canSave = allEntriesValid && !collides

  return (
    <div className='space-y-2'>
      <div className='grid grid-cols-7 gap-1 text-center'>
        {DAYS_OF_WEEK.map((day) => {
          const idx = findIndex(day)
          const field =
            idx > -1
              ? (fields[idx] as unknown as { times: RegularShiftTimeEntry[] })
              : undefined
          const firstTime = field?.times?.[0]
          const extraCount = (field?.times?.length ?? 0) - 1
          return (
            <button
              key={day}
              type='button'
              disabled={disabled}
              onClick={() => openDialogFor(day)}
              className={cn(
                'rounded-md border p-2 text-xs capitalize transition-colors',
                field
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {day.slice(0, 3)}
              {firstTime && (
                <div className='text-[10px] opacity-80'>
                  {firstTime.from_time}–{firstTime.to_time}
                  {extraCount > 0 && ` +${extraCount}`}
                </div>
              )}
            </button>
          )
        })}
      </div>
      {daysError && <p className='text-sm text-destructive'>{daysError}</p>}

      <Dialog
        open={openDay != null}
        onOpenChange={(open) => !open && setOpenDay(null)}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle className='capitalize'>Select {openDay}</DialogTitle>
          </DialogHeader>

          <div className='space-y-3'>
            {draft.map((t, i) => {
              const valid = isEntryValid(t)
              return (
                <div key={i} className='space-y-1.5 rounded-md border p-2'>
                  <div className='flex items-start gap-2'>
                    <div className='flex-1 space-y-1'>
                      <Label>From</Label>
                      <Input
                        type='time'
                        value={t.from_time}
                        onChange={(e) =>
                          updateTime(i, { from_time: e.target.value })
                        }
                      />
                    </div>
                    <div className='flex-1 space-y-1'>
                      <Label>To</Label>
                      <Input
                        type='time'
                        value={t.to_time}
                        min={t.overnight ? undefined : t.from_time || undefined}
                        onChange={(e) =>
                          updateTime(i, { to_time: e.target.value })
                        }
                      />
                    </div>
                    {draft.length > 1 && (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='mt-6'
                        onClick={() => removeTime(i)}
                        aria-label='Remove time range'
                      >
                        <X className='size-4' />
                      </Button>
                    )}
                  </div>
                  <div className='flex items-center justify-between'>
                    <Label className='flex cursor-pointer items-center gap-2 font-normal'>
                      <Switch
                        checked={!!t.overnight}
                        onCheckedChange={(checked) =>
                          updateTime(i, { overnight: checked })
                        }
                      />
                      Overnight
                    </Label>
                    <span className='text-xs text-muted-foreground'>
                      {valid ? `${calculateHours([t])}h` : '—'}
                    </span>
                  </div>
                </div>
              )
            })}

            <Button
              type='button'
              variant='outline'
              size='sm'
              className='w-full'
              onClick={addTime}
            >
              <Plus className='size-4' /> Add time
            </Button>

            {collides && (
              <p className='text-sm text-destructive'>
                These times overlap — adjust them so they don&apos;t collide.
              </p>
            )}

            <p className='text-end text-sm text-muted-foreground'>
              Total: {allEntriesValid ? `${calculateHours(draft)}h` : '—'}
            </p>
          </div>

          <DialogFooter className='sm:justify-between'>
            {openDay && findIndex(openDay) > -1 && (
              <Button type='button' variant='ghost' onClick={removeDay}>
                Remove day
              </Button>
            )}
            <Button type='button' disabled={!canSave} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
