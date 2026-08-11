import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { SCHEDULE_TYPES } from '../data/data'
import { type Schedule, type ScheduleType } from '../data/schema'
import { getScheduleSummary, getScheduleTotalHours } from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

const typeVariant: Record<ScheduleType, 'default' | 'secondary' | 'outline'> = {
  weekly: 'default',
  weekly_one: 'secondary',
  monthly: 'outline',
}

export const schedulesColumns: ColumnDef<Schedule>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    meta: { className: 'ps-1 w-1/5', tdClassName: 'ps-4 max-w-0' },
    cell: ({ row }) => (
      <span className='block truncate font-medium'>
        {row.getValue('name')}
      </span>
    ),
  },
  {
    id: 'type',
    accessorFn: (row) => (row.parent_type === 'daily' ? row.type : 'regular'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => {
      const schedule = row.original
      if (schedule.parent_type === 'regular') {
        return <Badge variant='outline'>Regular</Badge>
      }
      const label =
        SCHEDULE_TYPES.find((t) => t.value === schedule.type)?.label ??
        schedule.type
      return <Badge variant={typeVariant[schedule.type]}>{label}</Badge>
    },
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Description' />
    ),
    meta: { className: 'w-1/5', tdClassName: 'max-w-0' },
    cell: ({ row }) => (
      <span className='text-muted-foreground block truncate text-sm'>
        {row.getValue('description') || '—'}
      </span>
    ),
  },
  {
    id: 'employees',
    header: 'Employees',
    meta: { className: 'w-1/6', tdClassName: 'max-w-0' },
    cell: ({ row }) => {
      const schedule = row.original
      if (schedule.parent_type === 'regular') {
        return <span className='text-muted-foreground text-sm'>—</span>
      }
      const names = schedule.employees.map((e) => e.label)
      return (
        <span className='text-muted-foreground block truncate text-sm'>
          {names.length > 2
            ? `${names.slice(0, 2).join(', ')} +${names.length - 2}`
            : names.join(', ')}
        </span>
      )
    },
  },
  {
    id: 'summary',
    header: 'Summary',
    meta: { className: 'w-1/6', tdClassName: 'max-w-0' },
    cell: ({ row }) => (
      <span className='text-muted-foreground block truncate text-sm'>
        {getScheduleSummary(row.original)}
      </span>
    ),
  },
  {
    id: 'hours',
    accessorFn: (row) => getScheduleTotalHours(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Hours' />
    ),
    cell: ({ getValue }) => (
      <span className='text-sm'>{getValue<number>()}h</span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
