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

// One calendar day is one fixed-width column, and the header row is built from
// the same blocks as the crew rows — that shared width is the only thing
// keeping a date above the dot it belongs to, so it lives in one constant
// rather than being restated per row.
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
  // Absent for a day before this crew joined the rotation — the column still
  // has to hold its width, or every row below would slip out of step with the
  // dates in the header.
  position: RotationPosition | undefined
  day: TimelineDay
  span: RotationTimeline['span']
}) {
  if (!position) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          DAY_COLUMN[span]
        )}
        aria-hidden
      />
    )
  }

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
          // Today gets a ring rather than a different fill: the fill already
          // means "which shift", and overloading it would make one crew's
          // Tuesday look like a shift nobody has.
          day.isToday &&
            'ring-2 ring-foreground/60 ring-offset-2 ring-offset-background'
        )}
      />
    </div>
  )
}

// The key to the dots. Deliberately the first thing on the card: a grid of
// bare colored circles is unreadable until this has been read once.
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
        {/* The day this crew joins the rotation. A staggered roster is
            written as "Team B starts on week 2", so the date that sentence
            resolves to belongs next to the name. */}
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
  // Where each block starts in the flat `cells` array. Recomputed from the
  // blocks rather than stored, so a short final block (a cycle that is not a
  // multiple of seven days) can never put a row out of step with its header.
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
          {/* Column headers — block name over the seven days it covers. */}
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
