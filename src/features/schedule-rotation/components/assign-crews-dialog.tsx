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
import {
  crewKeysFromDayCoverage,
  crewSelectionFromDayCoverage,
} from '@/features/schedules/rotation-crews'
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

// Mounted fresh (via `key={schedule.id}`) per schedule so `defaultValues`
// never needs to reset mid-life — react-hook-form only reads them on mount.
export function AssignToPanel({
  schedule,
  onSaved,
}: {
  schedule: RotateSchedule
  onSaved?: () => void
}) {
  const updateSchedule = useSchedulesStore((s) => s.updateSchedule)
  // Triggers commitPendingSuggestion so a picked-but-unapplied suggestion is
  // saved (see schedule-assign-to-fields.tsx).
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
      // updateSchedule replaces the whole record, so every field either
      // section could touch must come from the form, not the stale closure.
      pattern: values.pattern,
      day_coverage: values.day_coverage,
      crew_placements: values.crew_placements,
      start_date: values.start_date,
      end_settings: values.end_settings,
      // Keeps the wizard's "Assign to" pick in step so re-editing opens on
      // these crews.
      ...crewSelectionFromDayCoverage(values.day_coverage),
    })
    toast.success(`Crew assignment saved for "${schedule.name}".`)
    onSaved?.()
  }

  return (
    <FormProvider {...form}>
      <div className='space-y-6'>
        <ScheduleAssignToFields
          schedule={schedule}
          commitRef={commitRef}
          startEnd={<ScheduleStartEndFields />}
        />
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
  // Fallback only — the picker defaults to the first unstaffed schedule when
  // one exists, since staffing it is the point of this dialog.
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

  // Unassigned first — that ordering also decides the default selection.
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
        // Guards against a portaled picker menu reading a click on it as
        // outside the dialog (bit team-form-dialog.tsx). These pickers render
        // inline today, so this is currently a no-op safety net.
        onInteractOutside={(event) => {
          const target = event.detail.originalEvent.target as HTMLElement | null
          if (target?.closest('.multi-select-menu-portal'))
            event.preventDefault()
        }}
      >
        <DialogHeader className='text-start'>
          <DialogTitle>Assign crews</DialogTitle>
          <DialogDescription>
            Pick a rotate schedule and its crews, set when it starts and ends,
            then say who covers each shift on each day. Picking an
            already-assigned schedule opens its roster for editing.
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
