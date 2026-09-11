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
  // What the last column is showing, spelled out by the caller — the table
  // reads one specific day of the range on screen, so naming that day is the
  // only honest header. A period word ("this week") would be a lie the moment
  // a rotation advances daily and a person works three shifts inside it.
  assignedHeading: string
  cycleLength: number
}

// How this employee's crew was placed against the pattern — the sentence the
// rotation was designed in ("Team B starts on week 2"), read back where
// somebody is looking at the result.
//
// Absent for a rotation finished by hand: `startDay` is only filled in while
// the stored start days still describe the stored matrix (see
// `buildRotation`), so nothing here can claim a stagger the grid does not
// have. The crew name still shows, because that stays true either way.
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
