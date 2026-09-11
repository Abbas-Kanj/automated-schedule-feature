import { format } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { getFixedLabel } from '../data/data'
import { type PublicHoliday } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const publicHolidaysColumns: ColumnDef<PublicHoliday>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-56 font-medium'>{row.original.name}</LongText>
    ),
    // Substring match, so the toolbar's search box can target this column
    // directly instead of the table-wide global filter.
    filterFn: (row, _id, value) =>
      row.original.name.toLowerCase().includes(String(value).toLowerCase()),
    enableHiding: false,
  },
  {
    id: 'days',
    accessorFn: (row) => row.holiday_dates.length,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Days' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.holiday_dates.length}</span>
    ),
  },
  {
    id: 'weekdays',
    accessorFn: (row) =>
      row.holiday_dates.map((date) => format(date, 'EEEE')).join(', '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Weekday' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-1'>
        {row.original.holiday_dates.map((date) => (
          <Badge
            key={date.toISOString()}
            variant='outline'
            className='whitespace-nowrap'
          >
            {format(date, 'EEE')}
          </Badge>
        ))}
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'holiday_dates',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Dates' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-96 flex-wrap gap-1'>
        {row.original.holiday_dates.map((date) => (
          <Badge
            key={date.toISOString()}
            variant='secondary'
            className='whitespace-nowrap'
          >
            {format(date, 'dd MMM yyyy')}
          </Badge>
        ))}
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      rowA.original.holiday_dates[0].getTime() -
      rowB.original.holiday_dates[0].getTime(),
  },
  {
    id: 'fixed',
    accessorFn: (row) => (row.fixed ? 'yes' : 'no'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Fixed' />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.fixed ? 'default' : 'outline'}>
        {getFixedLabel(row.original.fixed)}
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
