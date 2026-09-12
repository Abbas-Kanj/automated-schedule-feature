import { useMemo, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScheduleAssignToFields } from '@/features/schedules/components/schedule-form/schedule-assign-to-fields'
import { ScheduleStartEndFields } from '@/features/schedules/components/schedule-form/schedule-start-end-fields'
import {
  type EndSettings,
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type RotatePatternEntry,
} from '@/features/schedules/data/schema'
import { crewKeysFromDayCoverage } from '@/features/schedules/rotation-crews'
import { useSchedulesStore } from '@/features/schedules/stores/schedules-store'
import { type RotateSchedule, isRotateSchedule } from '../utils'

type AssignFormValues = {
  pattern: RotatePatternEntry[]
  shift_ids: string[]
  start_date: string
  end_settings: EndSettings
  day_coverage: RotateDayCoverage[]
  crew_placements: RotateCrewPlacement[]
}

function crewCount(schedule: RotateSchedule): number {
  return crewKeysFromDayCoverage(schedule.day_coverage).length
}

function crewStatusLabel(schedule: RotateSchedule): string {
  const count = crewCount(schedule)
  return count === 0
    ? 'Not yet assigned'
    : `${count} crew${count === 1 ? '' : 's'} assigned`
}

// Mounted fresh (via `key={schedule.id}` at the call site) every time the
// picker above switches schedules, so this form's `defaultValues` never has
// to reset itself mid-life — react-hook-form only reads them once, on mount.
export function AssignToPanel({
  schedule,
  onSaved,
}: {
  schedule: RotateSchedule
  onSaved?: () => void
}) {
  const updateSchedule = useSchedulesStore((s) => s.updateSchedule)
  // Same commit hook the wizard used to call from "Next" — see
  // `schedule-assign-to-fields.tsx#commitPendingSuggestion`. Here "Save"
  // plays that role instead.
  const commitRef = useRef<(() => void) | null>(null)
  const form = useForm<AssignFormValues>({
    defaultValues: {
      pattern: schedule.pattern,
      shift_ids: schedule.shift_ids,
      start_date: schedule.start_date,
      end_settings: schedule.end_settings,
      day_coverage: schedule.day_coverage,
      crew_placements: schedule.crew_placements,
    },
  })

  const handleSave = () => {
    commitRef.current?.()
    const values = form.getValues()
    updateSchedule(schedule.id, {
      ...schedule,
      // `pattern` is included defensively — the assign-to fields never
      // actually mutate it — but `updateSchedule` replaces the whole
      // record, so everything either section could plausibly have touched
      // has to come from the form, not the stale `schedule` closure.
      pattern: values.pattern,
      day_coverage: values.day_coverage,
      crew_placements: values.crew_placements,
      start_date: values.start_date,
      end_settings: values.end_settings,
    })
    toast.success(`Crew assignment saved for "${schedule.name}".`)
    onSaved?.()
  }

  return (
    <FormProvider {...form}>
      <div className='space-y-6'>
        <ScheduleAssignToFields commitRef={commitRef} />
        <div className='space-y-3'>
          <h3 className='text-base font-semibold'>Start &amp; End</h3>
          <ScheduleStartEndFields />
        </div>
        <div className='flex justify-end'>
          <Button onClick={handleSave}>Save assignment</Button>
        </div>
      </div>
    </FormProvider>
  )
}

type AssignCrewsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The schedule the rotation screen is currently showing. Only a fallback:
  // the picker opens on a schedule nobody has staffed yet when there is one,
  // since that is the job this dialog exists to get done.
  scheduleId?: string
}

export function AssignCrewsDialog({
  open,
  onOpenChange,
  scheduleId,
}: AssignCrewsDialogProps) {
  const schedules = useSchedulesStore((s) => s.schedules)
  const rotateSchedules = useMemo(
    () => schedules.filter(isRotateSchedule),
    [schedules]
  )

  // Unassigned first, and that ordering decides the default selection too —
  // the whole point of opening this is usually to staff something that is not
  // staffed yet.
  const { unassigned, assigned } = useMemo(() => {
    const byName = (a: RotateSchedule, b: RotateSchedule) =>
      a.name.localeCompare(b.name)
    return {
      unassigned: rotateSchedules
        .filter((s) => crewCount(s) === 0)
        .sort(byName),
      assigned: rotateSchedules.filter((s) => crewCount(s) > 0).sort(byName),
    }
  }, [rotateSchedules])

  const [selectedId, setSelectedId] = useState(
    () => unassigned[0]?.id ?? scheduleId ?? ''
  )
  const schedule = rotateSchedules.find((s) => s.id === selectedId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='sm:max-w-4xl'
        // `MultiSelect` portals its menu outside the dialog, so without this
        // every click on an employee reads as an outside-click and closes the
        // whole dialog. Same guard as `team-form-dialog.tsx`.
        onInteractOutside={(event) => {
          const target = event.detail.originalEvent.target as HTMLElement | null
          if (target?.closest('.multi-select-menu-portal'))
            event.preventDefault()
        }}
      >
        <DialogHeader className='text-start'>
          <DialogTitle>Assign crews</DialogTitle>
          <DialogDescription>
            Pick a rotate schedule, then say who covers each shift on each day
            of its cycle. Picking an already-assigned schedule opens its roster
            for editing.
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[70vh] space-y-6 overflow-y-auto px-0.5'>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className='w-full sm:w-80'>
              <SelectValue placeholder='Select a rotate schedule' />
            </SelectTrigger>
            <SelectContent>
              {unassigned.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Not assigned</SelectLabel>
                  {unassigned.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {crewStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {assigned.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Assigned</SelectLabel>
                  {assigned.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {crewStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {rotateSchedules.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No rotate schedules yet — create one from Schedules first.
            </p>
          ) : (
            schedule && (
              <AssignToPanel
                key={schedule.id}
                schedule={schedule}
                onSaved={() => onOpenChange(false)}
              />
            )
          )}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
