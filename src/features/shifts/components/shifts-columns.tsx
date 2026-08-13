import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { SHIFT_BADGE_COLOR_OPTIONS, SHIFT_ICON_OPTIONS } from '../data/data'
import { type Shift } from '../data/schema'
import { calculateShiftHours } from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

export const shiftsColumns: ColumnDef<Shift>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    meta: { className: 'ps-1 w-1/5', tdClassName: 'ps-4 max-w-0' },
    cell: ({ row }) => {
      const shift = row.original
      const icon = SHIFT_ICON_OPTIONS.find((o) => o.value === shift.icon)
      const Icon = icon?.icon
      return (
        <span className='flex items-center gap-2 truncate font-medium'>
          {Icon && <Icon className='text-muted-foreground size-4 shrink-0' />}
          <span className='truncate'>{shift.name}</span>
        </span>
      )
    },
  },
  {
    accessorKey: 'short_code',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Code' />
    ),
    cell: ({ row }) => {
      const shift = row.original
      const color = SHIFT_BADGE_COLOR_OPTIONS.find(
        (o) => o.value === shift.badge_color
      )
      return (
        <Badge variant='outline' className='gap-1.5'>
          <span
            className={cn('size-2 rounded-full', color?.swatchClassName)}
          />
          {shift.short_code}
        </Badge>
      )
    },
  },
  {
    id: 'time',
    header: 'Time',
    cell: ({ row }) => {
      const shift = row.original
      return (
        <span className='text-sm'>
          {shift.from_time} – {shift.to_time}
          {shift.overnight && (
            <span className='text-muted-foreground'> (+1d)</span>
          )}
        </span>
      )
    },
  },
  {
    id: 'hours',
    accessorFn: (row) =>
      calculateShiftHours(row.from_time, row.to_time, row.overnight),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Hours' />
    ),
    cell: ({ getValue }) => (
      <span className='text-sm'>{getValue<number>()}h</span>
    ),
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Description' />
    ),
    meta: { className: 'w-1/3', tdClassName: 'max-w-0' },
    cell: ({ row }) => (
      <span className='text-muted-foreground block truncate text-sm'>
        {row.getValue('description') || '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
