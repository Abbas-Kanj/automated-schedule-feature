import { useMemo } from 'react'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { type RotateDayCoverage } from '../../data/schema'
import { crewsFromDayCoverage } from '../../rotation-crews'

type AssignToStatusNoteProps = {
  dayCoverage: RotateDayCoverage[] | undefined
}

// Crew assignment for a rotate schedule no longer happens in this form — it
// moved to the "Assign crews" dialog on `/schedule-rotation` (see
// `schedule-rotation/components/assign-crews-dialog.tsx`), which is the only
// place `day_coverage`/`crew_placements` get edited now. This is
// just a status line pointing there, sized from whatever the schedule
// already holds — shown both in the wizard's Summary step and on the
// read-only View page.
export function AssignToStatusNote({ dayCoverage }: AssignToStatusNoteProps) {
  const teams = useTeamsStore((s) => s.teams)
  const employees = useEmployeesStore((s) => s.employees)

  const employeeLabels = useMemo(
    () =>
      new Map(
        employees
          .filter((employee) => employee.id)
          .map((employee) => [
            employee.id as string,
            getEmployeeFullName(employee),
          ])
      ),
    [employees]
  )

  const crews = useMemo(
    () => crewsFromDayCoverage(dayCoverage ?? [], teams, employeeLabels),
    [dayCoverage, teams, employeeLabels]
  )

  return (
    <p className='text-sm text-muted-foreground'>
      {crews.length === 0
        ? 'Not yet assigned — assign crews from Schedule Rotation after saving.'
        : `${crews.length} crew${crews.length === 1 ? '' : 's'} assigned. Manage the roster from Schedule Rotation.`}
    </p>
  )
}
