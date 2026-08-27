import { useMemo } from 'react'
import { DataTable } from '@/components/data-table'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { type Team } from '../data/schema'
import { teamsColumns } from './teams-columns'

type TeamsTableProps = {
  data: Team[]
}

export function TeamsTable({ data }: TeamsTableProps) {
  const employees = useEmployeesStore((s) => s.employees)

  // id -> full name, so the search can also match a team by one of its
  // members' names, not just the team name.
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const employee of employees) {
      if (employee.id) map.set(employee.id, getEmployeeFullName(employee))
    }
    return map
  }, [employees])

  return (
    <DataTable
      columns={teamsColumns}
      data={data}
      searchPlaceholder='Search teams...'
      globalFilterFn={(row, _columnId, filterValue) => {
        const needle = String(filterValue).toLowerCase()
        if (row.original.name.toLowerCase().includes(needle)) return true
        return row.original.employee_ids.some((id) =>
          (nameById.get(id) ?? '').toLowerCase().includes(needle)
        )
      }}
    />
  )
}
