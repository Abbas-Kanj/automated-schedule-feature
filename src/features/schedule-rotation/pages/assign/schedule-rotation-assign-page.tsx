import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
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
import { isRotateSchedule, type RotateSchedule } from '../../utils'

type AssignFormValues = {
  pattern: RotatePatternEntry[]
  shift_ids: string[]
  start_date: string
  end_settings: EndSettings
  day_coverage: RotateDayCoverage[]
  crew_placements: RotateCrewPlacement[]
}

function crewStatusLabel(schedule: RotateSchedule): string {
  const count = crewKeysFromDayCoverage(schedule.day_coverage).length
  return count === 0
    ? 'Not yet assigned'
    : `${count} crew${count === 1 ? '' : 's'} assigned`
}

// Mounted fresh (via `key={schedule.id}` at the call site) every time the
// picker above switches schedules, so this form's `defaultValues` never has
// to reset itself mid-life — react-hook-form only reads them once, on mount.
export function AssignToPanel({ schedule }: { schedule: RotateSchedule }) {
  const navigate = useNavigate()
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
    navigate({ to: '/schedule-rotation' })
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

export function ScheduleRotationAssignPage() {
  const search = useSearch({
    from: '/_authenticated/schedule-rotation/assign/',
  })
  const schedules = useSchedulesStore((s) => s.schedules)
  const rotateSchedules = useMemo(
    () => schedules.filter(isRotateSchedule),
    [schedules]
  )

  const [scheduleId, setScheduleId] = useState(search.scheduleId ?? '')
  const schedule = rotateSchedules.find((s) => s.id === scheduleId)

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <Button variant='ghost' size='sm' asChild className='-ms-3 mb-1'>
            <Link to='/schedule-rotation'>
              <ArrowLeft className='size-4' /> Back to Schedule Rotation
            </Link>
          </Button>
          <h2 className='text-2xl font-bold tracking-tight'>Assign crews</h2>
          <p className='text-muted-foreground'>
            Pick a rotate schedule, then say who covers each shift on each day
            of its cycle. Picking an already-assigned schedule opens its
            roster for editing.
          </p>
        </div>

        <Select value={scheduleId} onValueChange={setScheduleId}>
          <SelectTrigger className='w-full sm:w-72'>
            <SelectValue placeholder='Select a rotate schedule' />
          </SelectTrigger>
          <SelectContent>
            {rotateSchedules.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} — {crewStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {rotateSchedules.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No rotate schedules yet — create one from Schedules first.
          </p>
        ) : (
          schedule && <AssignToPanel key={schedule.id} schedule={schedule} />
        )}
      </Main>
    </>
  )
}
