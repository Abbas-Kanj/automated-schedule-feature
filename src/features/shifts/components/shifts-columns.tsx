import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { useTimeFormat } from '@/lib/time-format'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_OPTIONS,
  SHIFT_POLICY_TYPE_OPTIONS,
  SHIFT_TYPE_OPTIONS,
} from '../data/data'
import { type Shift } from '../data/schema'
import { getShiftTimeRange } from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

// `TimeCell` hosts the time-format hook for the Start/End time columns; it
// coexists with the file's non-component `shiftsColumns` export, which
// fast refresh doesn't support — acceptable for a column-def module.
// eslint-disable-next-line react-refresh/only-export-components
function TimeCell({ value }: { value: string | null }) {
  const formatTime = useTimeFormat()
  return <span className='text-sm'>{value ? formatTime(value) : '—'}</span>
}

export const shiftsColumns: ColumnDef<Shift>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    meta: { className: 'ps-1 w-1/4', tdClassName: 'ps-4 max-w-0' },
    cell: ({ row }) => {
      const shift = row.original
      const icon = SHIFT_ICON_OPTIONS.find((o) => o.value === shift.icon)
      const color = SHIFT_BADGE_COLOR_OPTIONS.find(
        (o) => o.value === shift.badge_color
      )
      const Icon = icon?.icon
      return (
        <span className='flex items-center gap-2 truncate font-medium'>
          <span
            className={cn('size-2 shrink-0 rounded-full', color?.swatchClassName)}
          />
          {Icon && <Icon className='text-muted-foreground size-4 shrink-0' />}
          <span className='truncate'>{shift.name}</span>
        </span>
      )
    },
  },
  {
    id: 'start_time',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Start time' />
    ),
    accessorFn: (row) => getShiftTimeRange(row.days)?.from_time ?? '',
    cell: ({ row }) => (
      <TimeCell value={getShiftTimeRange(row.original.days)?.from_time ?? null} />
    ),
  },
  {
    id: 'end_time',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='End time' />
    ),
    accessorFn: (row) => getShiftTimeRange(row.days)?.to_time ?? '',
    cell: ({ row }) => (
      <TimeCell value={getShiftTimeRange(row.original.days)?.to_time ?? null} />
    ),
  },
  {
    accessorKey: 'shift_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => {
      const option = SHIFT_TYPE_OPTIONS.find(
        (o) => o.value === row.original.shift_type
      )
      return <Badge variant='outline'>{option?.label ?? '—'}</Badge>
    },
  },
  {
    accessorKey: 'policy_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Policy' />
    ),
    cell: ({ row }) => {
      const option = SHIFT_POLICY_TYPE_OPTIONS.find(
        (o) => o.value === row.original.policy_type
      )
      return <Badge variant='outline'>{option?.label ?? '—'}</Badge>
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
