import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { DataTableColumnHeader } from '@/components/data-table'
import { type Employee } from '../../employees/data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const employeesColumns: ColumnDef<Employee>[] = [
  {
    accessorKey: 'punch_code',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Punch code' />
    ),
    cell: ({ row }) => (
      <p className='max-w-36 ps-3'>{row.getValue('punch_code')}</p>
    ),
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
        'inset-s-6 ps-0.5 max-md:sticky @4xl/content:table-cell @4xl/content:drop-shadow-none'
      ),
    },
    enableHiding: false,
  },

  {
    id: 'firstname',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Firstname' />
    ),
    cell: ({ row }) => {
      return <span className='max-w-36'>{row.original.firstname}</span>
    },
    meta: { className: 'w-36' },
  },
  {
    id: 'lastname',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lastname' />
    ),
    cell: ({ row }) => {
      return <span className='max-w-36'>{row.original.lastname}</span>
    },
    meta: { className: 'w-36' },
  },
  {
    accessorKey: 'schedule',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Schedule' />
    ),
    cell: ({ row }) => (
      <div className='w-fit ps-2 text-nowrap'>{row.getValue('schedule')}</div>
    ),
  },
  {
    accessorKey: 'organization_unit',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='OU' />
    ),
    cell: ({ row }) => <div>{row.original.organization_unit.value}</div>,
    enableSorting: false,
  },

  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
