import { type ColumnDef } from '@tanstack/react-table'
import { useTimeFormat } from '@/lib/time-format'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import {
  getAttendanceTypeLabel,
  getHolidayAttendanceTypeLabel,
  getPolicyTypeLabel,
} from '../data/data'
import {
  getPolicyRuleTypes,
  isHolidayWorkRule,
  isWindowRule,
  type PolicyRule,
  type ShiftPolicy,
} from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

// Earliest start / latest end across a policy's rules — a summary of when
// the policy applies, not a promise every rule shares that window. Only
// window rules have a from/to span; missed-punch (occurrence count) and
// holiday-work (flat hours) rules sit this one out.
function getRuleWindow(rules: PolicyRule[]) {
  const windows = rules.filter(isWindowRule)
  if (!windows.length) return null
  return {
    from_time: windows.reduce(
      (min, r) => (r.from_time < min ? r.from_time : min),
      windows[0].from_time
    ),
    to_time: windows.reduce(
      (max, r) => (r.to_time > max ? r.to_time : max),
      windows[0].to_time
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
    // The policy has no type of its own any more — it's whatever its rules
    // cover, which can be several things at once.
    id: 'policy_types',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    accessorFn: (row) =>
      getPolicyRuleTypes(row.rules).map(getPolicyTypeLabel).join(', '),
    cell: ({ row }) => {
      const types = getPolicyRuleTypes(row.original.rules)
      if (!types.length)
        return <span className='text-sm text-muted-foreground'>—</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {types.map((type) => (
            <Badge key={type} variant='outline' className='whitespace-nowrap'>
              {getPolicyTypeLabel(type)}
            </Badge>
          ))}
        </div>
      )
    },
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
      // Holiday-work rules book a different attendance vocabulary (and none
      // at all for the day-off overtime case), so resolve each rule's label
      // by its shape. Blanks ('—') drop out.
      const labels = [
        ...new Set(
          row.original.rules.map((r) =>
            isHolidayWorkRule(r)
              ? getHolidayAttendanceTypeLabel(r.holiday_attendance_type)
              : getAttendanceTypeLabel(r.attendance_type)
          )
        ),
      ].filter((label) => label !== '—')
      if (!labels.length)
        return <span className='text-sm text-muted-foreground'>—</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {labels.map((label) => (
            <Badge key={label} variant='secondary' className='whitespace-nowrap'>
              {label}
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
