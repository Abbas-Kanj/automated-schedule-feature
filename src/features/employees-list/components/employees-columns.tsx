import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import { DataTableRowActions } from './data-table-row-actions'

export const employeesColumns: ColumnDef<Employee>[] = [
  {
    id: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    accessorFn: (row) => getEmployeeFullName(row),
    meta: { className: 'ps-1 w-1/4', tdClassName: 'ps-4 max-w-0' },
    cell: ({ row }) => (
      <div className='min-w-0'>
        <p className='truncate font-medium'>
          {getEmployeeFullName(row.original)}
        </p>
        {row.original.punch_code && (
          <p className='truncate text-xs text-muted-foreground'>
            {row.original.punch_code}
          </p>
        )}
      </div>
    ),
  },
  {
    id: 'position',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Position' />
    ),
    accessorFn: (row) => row.position.label,
    cell: ({ row }) => (
      <Badge variant='outline' className='whitespace-nowrap'>
        {row.original.position.label}
      </Badge>
    ),
  },
  {
    accessorKey: 'schedule',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Schedule' />
    ),
    cell: ({ row }) => (
      <span className='text-sm whitespace-nowrap'>{row.original.schedule}</span>
    ),
  },
  {
    id: 'organization_unit',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Organization unit' />
    ),
    accessorFn: (row) => row.organization_unit.label,
    cell: ({ row }) => (
      <Badge variant='secondary' className='whitespace-nowrap'>
        {row.original.organization_unit.label}
      </Badge>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
