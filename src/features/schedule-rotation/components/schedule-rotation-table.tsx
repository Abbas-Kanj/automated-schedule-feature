import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { describeStartDay } from '@/features/schedules/utils'
import { type RotationRow } from '../utils'
import { ShiftBadge } from './shift-badge'

type ScheduleRotationTableProps = {
  rows: RotationRow[]
  // Spelled out by the caller: this reads one specific day, so a period word
  // like "this week" would misdescribe a daily-advancing rotation.
  assignedHeading: string
  cycleLength: number
}

// `startDay` is only set while the stored start days still describe the
// stored matrix (see `buildRotation`) — a hand-finished rotation shows just
// the crew name rather than claiming a stagger the grid no longer has.
function CrewNote({
  row,
  cycleLength,
}: {
  row: RotationRow
  cycleLength: number
}) {
  if (!row.crewLabel && row.startDay === undefined) return null
  return (
    <div className='text-xs text-muted-foreground'>
      {[
        row.crewLabel,
        row.startDay !== undefined &&
          `starts ${describeStartDay(row.startDay, cycleLength).toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    </div>
  )
}

// Rotated so the employee's current position is first and emphasized — e.g.
// Alice "M A N O", Bob "A N O M".
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
              ? 'font-semibold text-foreground underline decoration-2 underline-offset-4'
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
  assignedHeading,
  cycleLength,
}: ScheduleRotationTableProps) {
  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='ps-4'>Employee Name</TableHead>
            <TableHead>Current Schedule Sequence</TableHead>
            <TableHead className='pe-4 text-end'>{assignedHeading}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.employeeId}>
              <TableCell className='ps-4 align-middle'>
                <div className='font-medium'>{row.fullName}</div>
                {row.employee.position?.label && (
                  <div className='text-xs text-muted-foreground'>
                    {row.employee.position.label}
                  </div>
                )}
                <CrewNote row={row} cycleLength={cycleLength} />
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
