import { format } from 'date-fns'
import { useTimeFormat } from '@/lib/time-format'
import { cn } from '@/lib/utils'
import { getShiftTimeRange } from '@/features/shifts/utils'
import { OFF_DOT_CLASS, SHIFT_DOT_CLASSES } from '../data'
import {
  type RotationTimeline,
  type TimelineCrewRow,
  type TimelineDay,
} from '../timeline'
import { type RotationPosition } from '../utils'

type RotationTimelineProps = {
  timeline: RotationTimeline
}

// Shared with the header row's blocks — one constant keeps a date aligned
// above the dot it belongs to instead of restating the width per row.
const DAY_COLUMN = { week: 'w-12', month: 'w-6' } as const
const DOT_SIZE = { week: 'size-5', month: 'size-3' } as const

function dotClassName(position: RotationPosition): string {
  if (position.isOff || !position.badgeColor) return OFF_DOT_CLASS
  return SHIFT_DOT_CLASSES[position.badgeColor]
}

function ShiftDot({
  position,
  day,
  span,
}: {
  position: RotationPosition
  day: TimelineDay
  span: RotationTimeline['span']
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        DAY_COLUMN[span]
      )}
    >
      <span
        title={`${format(day.date, 'EEE, MMM d')} — ${position.label}`}
        className={cn(
          'rounded-full',
          DOT_SIZE[span],
          dotClassName(position),
          // A ring, not a different fill — the fill already means "which
          // shift".
          day.isToday &&
            'ring-2 ring-foreground/60 ring-offset-2 ring-offset-background'
        )}
      />
    </div>
  )
}

// Shown first: a grid of bare colored circles is unreadable without this.
function TimelineLegend({ legend }: { legend: RotationPosition[] }) {
  const formatTime = useTimeFormat()

  return (
    <div className='flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border px-4 py-3'>
      {legend.map((position) => {
        const range = position.shift
          ? getShiftTimeRange(position.shift.days)
          : null
        return (
          <div key={position.index} className='flex items-center gap-2'>
            <span
              className={cn(
                'size-3.5 shrink-0 rounded-full',
                dotClassName(position)
              )}
            />
            <div className='leading-tight'>
              <div className='text-xs font-semibold tracking-wide uppercase'>
                {position.label}
              </div>
              <div className='text-xs text-muted-foreground'>
                {range
                  ? `${formatTime(range.from_time)} – ${formatTime(range.to_time)}`
                  : 'Out of office'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CrewRow({
  row,
  timeline,
  offsetOf,
}: {
  row: TimelineCrewRow
  timeline: RotationTimeline
  offsetOf: (blockIndex: number) => number
}) {
  return (
    <div className='flex items-center gap-6 border-t px-4 py-3'>
      <div className='w-44 shrink-0'>
        <div className='truncate text-sm font-semibold' title={row.label}>
          {row.label}
        </div>
        <div className='text-xs text-muted-foreground'>
          {row.headcount === 1 ? '1 person' : `${row.headcount} people`}
          {' · '}
          {row.daysOn === 1 ? '1 day on' : `${row.daysOn} days on`}
        </div>
        {/* The date "Team B starts on week 2" resolves to. */}
        <div className='text-xs text-muted-foreground'>
          Starts {format(row.startDate, 'MMM d, yyyy')}
        </div>
      </div>
      {timeline.blocks.map((block, blockIndex) => (
        <div key={block.key} className='flex shrink-0 items-center gap-1'>
          {block.days.map((day, dayIndex) => (
            <ShiftDot
              key={day.date.toISOString()}
              position={row.cells[offsetOf(blockIndex) + dayIndex]}
              day={day}
              span={timeline.span}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function RotationTimelineGrid({ timeline }: RotationTimelineProps) {
  // Recomputed rather than stored, so a short final block (cycle length not a
  // multiple of seven) can't drift out of step with its header.
  const blockOffsets: number[] = []
  timeline.blocks.reduce((offset, block) => {
    blockOffsets.push(offset)
    return offset + block.days.length
  }, 0)

  return (
    <div className='flex flex-col gap-4'>
      <TimelineLegend legend={timeline.legend} />

      <div className='overflow-x-auto rounded-lg border'>
        <div className='min-w-max'>
          <div className='flex items-end gap-6 px-4 pt-4 pb-2'>
            <div className='w-44 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
              Crew
            </div>
            {timeline.blocks.map((block) => (
              <div key={block.key} className='shrink-0'>
                <div className='text-xs font-semibold tracking-wide uppercase'>
                  {block.label}
                </div>
                <div className='pb-1 text-[11px] text-muted-foreground'>
                  {block.sublabel}
                </div>
                <div className='flex items-center gap-1'>
                  {block.days.map((day) => (
                    <div
                      key={day.date.toISOString()}
                      className={cn(
                        'shrink-0 text-center text-[11px] text-muted-foreground tabular-nums',
                        DAY_COLUMN[timeline.span],
                        day.isToday && 'font-semibold text-foreground'
                      )}
                    >
                      {timeline.span === 'week' && (
                        <div className='text-[10px] uppercase'>
                          {format(day.date, 'EEE')}
                        </div>
                      )}
                      {format(day.date, 'd')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {timeline.rows.map((row) => (
            <CrewRow
              key={row.key}
              row={row}
              timeline={timeline}
              offsetOf={(blockIndex) => blockOffsets[blockIndex]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
