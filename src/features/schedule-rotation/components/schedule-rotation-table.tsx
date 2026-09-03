import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type RotationPeriodType, type RotationRow } from '../utils'
import { ShiftBadge } from './shift-badge'

type ScheduleRotationTableProps = {
  rows: RotationRow[]
  periodType: RotationPeriodType
}

// The single-letter cycle chips, rotated so the employee's current position
// is first and emphasized — e.g. Alice "M A N O", Bob "A N O M".
function SequenceChips({ row }: { row: RotationRow }) {
  return (
    <div className='flex items-center gap-2 font-mono text-sm tracking-wide'>
      {row.sequence.map((position, i) => (
        <span
          key={`${position.index}-${i}`}
          title={position.label}
          className={cn(
            'tabular-nums',
            i === 0
              ? 'text-foreground font-semibold underline decoration-2 underline-offset-4'
              : 'text-muted-foreground'
          )}
        >
          {position.letter}
        </span>
      ))}
    </div>
  )
}

export function ScheduleRotationTable({
  rows,
  periodType,
}: ScheduleRotationTableProps) {
  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='ps-4'>Employee Name</TableHead>
            <TableHead>Current Schedule Sequence</TableHead>
            <TableHead className='pe-4 text-end'>
              {periodType === 'daily'
                ? 'Assigned Shift Today'
                : `Assigned Shift This ${periodType === 'weekly' ? 'Week' : 'Month'}`}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.employeeId}>
              <TableCell className='ps-4 align-middle'>
                <div className='font-medium'>{row.fullName}</div>
                {row.employee.position?.label && (
                  <div className='text-muted-foreground text-xs'>
                    {row.employee.position.label}
                  </div>
                )}
              </TableCell>
              <TableCell className='align-middle'>
                <SequenceChips row={row} />
              </TableCell>
              <TableCell className='pe-4 text-end align-middle'>
                <ShiftBadge position={row.assigned} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
