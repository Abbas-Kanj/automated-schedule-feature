import { useEffect } from 'react'
import { z } from 'zod'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { ScheduleStartEndFields } from '@/features/schedules/components/schedule-form/schedule-start-end-fields'
import {
  dateStringSchema,
  endSettingsSchema,
} from '@/features/schedules/data/schema'
import { useSchedulesStore } from '@/features/schedules/stores/schedules-store'
import { type RotateSchedule } from '../utils'

// The two fields the rotate wizard no longer asks for. Same zod rules the
// schedule schema applies to them (both are re-exported from there rather
// than restated, so a change to either rule reaches this dialog too).
const rotationDatesSchema = z.object({
  start_date: dateStringSchema,
  end_settings: endSettingsSchema,
})

type RotationDatesValues = z.infer<typeof rotationDatesSchema>

type RotationDatesDialogProps = {
  schedule: RotateSchedule
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called with the saved start date. The screen it opens from counts every
  // date it shows from that value, so it has to be told to re-anchor — and
  // its own copy of the schedule is still the pre-save one at this point,
  // which is why the new date is handed over rather than re-read.
  onSaved?: (startDate: string) => void
}

// Edits a rotation's start date and end frequency in place — the "Start &
// End" step the schedule wizard used to carry for rotate schedules, moved
// next to the cycle it actually shifts. The body is the wizard's own
// `ScheduleStartEndFields`, so the two never drift apart.
export function RotationDatesDialog({
  schedule,
  open,
  onOpenChange,
  onSaved,
}: RotationDatesDialogProps) {
  const updateSchedule = useSchedulesStore((s) => s.updateSchedule)

  const form = useForm<RotationDatesValues>({
    resolver: zodResolver(rotationDatesSchema) as Resolver<RotationDatesValues>,
    defaultValues: {
      start_date: schedule.start_date,
      end_settings: schedule.end_settings,
    },
  })

  // The screen's schedule picker swaps `schedule` under a mounted dialog, and
  // the store is the source of truth for these values — so re-seed the form
  // whenever either changes rather than keeping whatever was typed against a
  // schedule the user has since navigated away from.
  useEffect(() => {
    form.reset({
      start_date: schedule.start_date,
      end_settings: schedule.end_settings,
    })
  }, [form, schedule.id, schedule.start_date, schedule.end_settings])

  const onSubmit = (values: RotationDatesValues) => {
    updateSchedule(schedule.id, {
      ...schedule,
      start_date: values.start_date,
      end_settings: values.end_settings,
    })
    toast.success(`Dates updated for "${schedule.name}".`)
    onSaved?.(values.start_date)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) {
          form.reset({
            start_date: schedule.start_date,
            end_settings: schedule.end_settings,
          })
        }
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>Start and end</DialogTitle>
          <DialogDescription>
            When this rotation begins, and when it stops repeating. The cycle
            below is read from the start date, so moving it re-dates every
            position.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id='rotation-dates-form'
            onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
            className='max-h-[60vh] space-y-4 overflow-y-auto px-0.5'
          >
            <ScheduleStartEndFields />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type='submit' form='rotation-dates-form'>
            Save dates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
