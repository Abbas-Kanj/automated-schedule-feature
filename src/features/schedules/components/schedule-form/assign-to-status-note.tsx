import { useMemo } from 'react'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { type RotateDayCoverage } from '../../data/schema'
import { crewsFromDayCoverage } from '../../rotation-crews'

type AssignToStatusNoteProps = {
  dayCoverage: RotateDayCoverage[] | undefined
}

// One-line recap of the "Assign to" step for the wizard's Summary, sized from
// whatever `day_coverage` holds. Rotate rosters can also be edited later from
// the "Assign crews" dialog on `/schedule-rotation`.
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
        ? 'Not yet assigned.'
        : `${crews.length} crew${crews.length === 1 ? '' : 's'} assigned.`}
    </p>
  )
}
