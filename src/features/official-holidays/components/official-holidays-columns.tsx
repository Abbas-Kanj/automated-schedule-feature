import { format } from 'date-fns'
import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { type OfficialHoliday } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const officialHolidaysColumns: ColumnDef<OfficialHoliday>[] = [
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
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='ID' />
    ),
    cell: ({ row }) => <div className='font-medium'>{row.getValue('id')}</div>,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-56'>{row.getValue('name')}</LongText>
    ),
    enableHiding: false,
  },
  {
    id: 'numberOfDays',
    accessorFn: (row) => row.holidayDates.length,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Number of Days' />
    ),
    cell: ({ row }) => (
      <div className='text-center'>{row.original.holidayDates.length}</div>
    ),
  },
  {
    accessorKey: 'holidayDates',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Holiday Dates' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-96 flex-wrap gap-1'>
        {row.original.holidayDates.map((date) => (
          <Badge key={date.toISOString()} variant='secondary'>
            {format(date, 'dd MMM yyyy')}
          </Badge>
        ))}
      </div>
    ),
    sortingFn: (rowA, rowB) =>
      rowA.original.holidayDates[0].getTime() -
      rowB.original.holidayDates[0].getTime(),
  },
  {
    id: 'rigid',
    accessorFn: (row) => (row.rigid ? 'yes' : 'no'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Rigid' />
    ),
    cell: ({ row }) => {
      const rigid = row.original.rigid
      return (
        <Badge
          variant='outline'
          className={cn(
            rigid
              ? 'border-teal-200 bg-teal-100/30 text-teal-900 dark:text-teal-200'
              : 'border-slate-200 bg-slate-100/40 text-slate-900 dark:text-slate-200'
          )}
        >
          {rigid ? 'Yes' : 'No'}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
    enableHiding: false,
  },
  { id: 'actions', cell: DataTableRowActions, enableHiding: false },
]
