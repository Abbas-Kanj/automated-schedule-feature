import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { type Team } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

// Resolves a team's member ids to display names, dropping any id that no
// longer matches a seeded employee. Hosts the store hook for the Members
// column; coexists with this file's non-component `teamsColumns` export,
// which fast refresh doesn't support — acceptable for a column-def module
// (same pattern as `policies-columns`).
// eslint-disable-next-line react-refresh/only-export-components
function MembersCell({ employeeIds }: { employeeIds: string[] }) {
  const employees = useEmployeesStore((s) => s.employees)
  const names = employeeIds
    .map((id) => {
      const match = employees.find((employee) => employee.id === id)
      return match ? getEmployeeFullName(match) : null
    })
    .filter((name): name is string => Boolean(name))

  if (!names.length)
    return <span className='text-sm text-muted-foreground'>—</span>

  return (
    <div className='flex flex-wrap gap-1'>
      {names.map((name) => (
        <Badge key={name} variant='secondary' className='whitespace-nowrap'>
          {name}
        </Badge>
      ))}
    </div>
  )
}

export const teamsColumns: ColumnDef<Team>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    meta: { className: 'ps-1 w-1/4', tdClassName: 'ps-4 max-w-0' },
    cell: ({ row }) => (
      <div className='min-w-0'>
        <p className='truncate font-medium'>{row.original.name}</p>
        {row.original.description && (
          <p className='truncate text-xs text-muted-foreground'>
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    id: 'member_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Members' />
    ),
    accessorFn: (row) => row.employee_ids.length,
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.employee_ids.length || '—'}</span>
    ),
  },
  {
    id: 'members',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Employees' />
    ),
    enableSorting: false,
    cell: ({ row }) => <MembersCell employeeIds={row.original.employee_ids} />,
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
