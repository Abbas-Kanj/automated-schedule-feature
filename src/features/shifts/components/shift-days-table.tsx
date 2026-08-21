import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DAY_LABELS } from '../data/data'
import { type DayTimeEntry } from '../data/schema'

type ShiftDaysTableProps = {
  days: DayTimeEntry[]
  formatTime: (time: string) => string
}

// A shift's enabled days as a "Day | Times" table, with consecutive days
// sharing the exact same times collapsed into a single row (e.g.
// "Mon → Fri  09:00–17:00") instead of N identical rows.
//
// Shared between the schedule wizard's "Shifts" step (see
// `schedules/.../shift-picker-field.tsx`) and its Summary step (see
// `schedules/.../schedule-summary.tsx`) so a shift reads identically in
// both places.
export function ShiftDaysTable({ days, formatTime }: ShiftDaysTableProps) {
  const rows: { days: DayTimeEntry[]; key: string }[] = []
  for (const day of days) {
    const key = day.times.map((t) => `${t.from_time}–${t.to_time}`).join(', ')
    const last = rows[rows.length - 1]
    if (last && last.key === key) {
      last.days.push(day)
    } else {
      rows.push({ days: [day], key })
    }
  }

  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='h-8'>Day</TableHead>
            <TableHead className='h-8'>Times</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const first = row.days[0]
            const lastDay = row.days[row.days.length - 1]
            const label =
              first.day === lastDay.day
                ? DAY_LABELS[first.day]
                : `${DAY_LABELS[first.day]} → ${DAY_LABELS[lastDay.day]}`
            const times = row.days[0].times
              .map((t) => `${formatTime(t.from_time)}–${formatTime(t.to_time)}`)
              .join(', ')
            return (
              <TableRow key={i} className='hover:bg-transparent'>
                <TableCell className='py-1.5 whitespace-nowrap text-muted-foreground'>
                  {label}
                </TableCell>
                <TableCell className='py-1.5 whitespace-normal text-muted-foreground'>
                  {times}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
