import { useState } from 'react'
import { useFieldArray, useFormContext, useFormState } from 'react-hook-form'
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
import { DAYS_OF_WEEK, type DayOfWeek, type TimeRange } from '../../data/schema'
import { calculateHours } from '../../utils'

const DEFAULT_TIME: TimeRange = { from_time: '09:00', to_time: '17:00' }

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
  const [draft, setDraft] = useState<TimeRange>(DEFAULT_TIME)

  const findIndex = (day: DayOfWeek) =>
    fields.findIndex((f) => (f as unknown as { day: DayOfWeek }).day === day)

  const openDialogFor = (day: DayOfWeek) => {
    if (disabled) return
    const idx = findIndex(day)
    setDraft(
      idx > -1
        ? (fields[idx] as unknown as { time: TimeRange }).time
        : DEFAULT_TIME
    )
    setOpenDay(day)
  }

  const save = () => {
    if (!openDay) return
    const idx = findIndex(openDay)
    if (idx > -1) {
      update(idx, { day: openDay, time: draft })
    } else {
      append({ day: openDay, time: draft })
    }
    setOpenDay(null)
  }

  const removeDay = () => {
    if (!openDay) return
    const idx = findIndex(openDay)
    if (idx > -1) remove(idx)
    setOpenDay(null)
  }

  const isValidRange = draft.from_time < draft.to_time

  return (
    <div className='space-y-2'>
      <div className='grid grid-cols-7 gap-1 text-center'>
        {DAYS_OF_WEEK.map((day) => {
          const idx = findIndex(day)
          const field =
            idx > -1
              ? (fields[idx] as unknown as { time: TimeRange })
              : undefined
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
              {field && (
                <div className='text-[10px] opacity-80'>
                  {field.time.from_time}–{field.time.to_time}
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
          <div className='flex items-start gap-2'>
            <div className='flex-1 space-y-1'>
              <Label>From</Label>
              <Input
                type='time'
                value={draft.from_time}
                max={draft.to_time || undefined}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, from_time: e.target.value }))
                }
              />
            </div>
            <div className='flex-1 space-y-1'>
              <Label>To</Label>
              <Input
                type='time'
                value={draft.to_time}
                min={draft.from_time || undefined}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, to_time: e.target.value }))
                }
              />
            </div>
          </div>
          <p className='text-sm text-muted-foreground'>
            Duration: {isValidRange ? `${calculateHours([draft])}h` : '—'}
          </p>
          <DialogFooter className='sm:justify-between'>
            {openDay && findIndex(openDay) > -1 && (
              <Button type='button' variant='ghost' onClick={removeDay}>
                Remove day
              </Button>
            )}
            <Button type='button' disabled={!isValidRange} onClick={save}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
