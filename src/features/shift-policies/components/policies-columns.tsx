import { type ColumnDef } from '@tanstack/react-table'
import { useTimeFormat } from '@/lib/time-format'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { getAttendanceTypeLabel, getPolicyTypeLabel } from '../data/data'
import { type PolicyRule, type ShiftPolicy } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

// Earliest start / latest end across a policy's rules — a summary of when
// the policy applies, not a promise every rule shares that window.
function getRuleWindow(rules: PolicyRule[]) {
  if (!rules.length) return null
  return {
    from_time: rules.reduce(
      (min, r) => (r.from_time < min ? r.from_time : min),
      rules[0].from_time
    ),
    to_time: rules.reduce(
      (max, r) => (r.to_time > max ? r.to_time : max),
      rules[0].to_time
    ),
  }
}

// Hosts the time-format hook for the Window column; coexists with this
// file's non-component `policiesColumns` export, which fast refresh doesn't
// support — acceptable for a column-def module (same as `shifts-columns`).
// eslint-disable-next-line react-refresh/only-export-components
function WindowCell({ rules }: { rules: PolicyRule[] }) {
  const formatTime = useTimeFormat()
  const window = getRuleWindow(rules)
  if (!window) return <span className='text-sm text-muted-foreground'>—</span>
  return (
    <span className='text-sm whitespace-nowrap'>
      {formatTime(window.from_time)}–{formatTime(window.to_time)}
    </span>
  )
}

export const policiesColumns: ColumnDef<ShiftPolicy>[] = [
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
    accessorKey: 'policy_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => (
      <Badge variant='outline' className='whitespace-nowrap'>
        {getPolicyTypeLabel(row.original.policy_type)}
      </Badge>
    ),
  },
  {
    id: 'window',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Window' />
    ),
    accessorFn: (row) => getRuleWindow(row.rules)?.from_time ?? '',
    cell: ({ row }) => <WindowCell rules={row.original.rules} />,
  },
  {
    id: 'rules',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Rules' />
    ),
    accessorFn: (row) => row.rules.length,
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.rules.length || '—'}</span>
    ),
  },
  {
    id: 'attendance_types',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Attendance' />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const labels = [
        ...new Set(row.original.rules.map((r) => r.attendance_type)),
      ]
      if (!labels.length)
        return <span className='text-sm text-muted-foreground'>—</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {labels.map((type) => (
            <Badge key={type} variant='secondary' className='whitespace-nowrap'>
              {getAttendanceTypeLabel(type)}
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
