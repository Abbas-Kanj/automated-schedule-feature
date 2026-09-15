import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShiftBadge } from '@/features/schedule-rotation/components/shift-badge'
import { type FixedEmployeeRow } from '../utils'

type FixedScheduleTableProps = {
  rows: FixedEmployeeRow[]
  // Names the one day the last column reads, same as the rotating table.
  dateHeading: string
}

export function FixedScheduleTable({
  rows,
  dateHeading,
}: FixedScheduleTableProps) {
  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='ps-4'>Employee Name</TableHead>
            <TableHead>Working Days</TableHead>
            <TableHead className='pe-4 text-end'>{dateHeading}</TableHead>
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
                {row.crewLabel && (
                  <div className='text-xs text-muted-foreground'>
                    {row.crewLabel}
                  </div>
                )}
              </TableCell>
              <TableCell className='align-middle'>
                <div className='flex flex-col gap-1.5'>
                  {row.shifts.map(({ position, days }) => (
                    <div
                      key={position.shift?.id ?? position.index}
                      className='flex flex-wrap items-center gap-2'
                    >
                      <ShiftBadge position={position} />
                      <span className='text-sm text-muted-foreground'>
                        {days.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell className='pe-4 text-end align-middle'>
                <ShiftBadge position={row.onDate} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
