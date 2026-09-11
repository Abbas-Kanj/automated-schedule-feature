import { format } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import { useTimeFormat } from '@/lib/time-format'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { getPriorityLabel, getStatusLabel } from '../data/data'
import {
  type ScheduleTemplate,
  type ScheduleTemplatePriority,
  type ScheduleTemplateStatus,
} from '../data/schema'
import { formatDuration } from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

// Theme tokens rather than raw palette classes, so both badges follow the
// app's light/dark themes like every other badge in the table.
const STATUS_VARIANTS: Record<
  ScheduleTemplateStatus,
  'default' | 'secondary' | 'outline'
> = {
  published: 'default',
  tentative: 'secondary',
  upcoming: 'outline',
}

const PRIORITY_VARIANTS: Record<
  ScheduleTemplatePriority,
  'destructive' | 'secondary' | 'outline'
> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

// Hosts the time-format hook for the Window column; coexists with this
// file's non-component `scheduleTemplatesColumns` export, which fast
// refresh doesn't support — same arrangement as `policies-columns`.
// eslint-disable-next-line react-refresh/only-export-components
function WindowCell({ template }: { template: ScheduleTemplate }) {
  const formatTime = useTimeFormat()
  return (
    <span className='text-sm whitespace-nowrap'>
      {formatTime(template.from_time)}–{formatTime(template.to_time)}
    </span>
  )
}

export const scheduleTemplatesColumns: ColumnDef<ScheduleTemplate>[] = [
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
    enableHiding: false,
  },
  {
    accessorKey: 'start_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Period' />
    ),
    cell: ({ row }) => (
      <span className='text-sm whitespace-nowrap'>
        {format(row.original.start_date, 'dd MMM yyyy')} –{' '}
        {format(row.original.end_date, 'dd MMM yyyy')}
      </span>
    ),
  },
  {
    id: 'window',
    accessorFn: (row) => row.from_time,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Window' />
    ),
    cell: ({ row }) => <WindowCell template={row.original} />,
  },
  {
    id: 'duration',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Duration' />
    ),
    accessorFn: (row) => row.from_time,
    cell: ({ row }) => (
      <span className='text-sm whitespace-nowrap'>
        {formatDuration(row.original.from_time, row.original.to_time)}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANTS[row.original.status]}>
        {getStatusLabel(row.original.status)}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Priority' />
    ),
    cell: ({ row }) => (
      <Badge variant={PRIORITY_VARIANTS[row.original.priority]}>
        {getPriorityLabel(row.original.priority)}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
    enableHiding: false,
  },
]
