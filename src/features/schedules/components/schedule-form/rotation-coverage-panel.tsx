import { cn } from '@/lib/utils'
import { SHIFT_BADGE_COLOR_OPTIONS } from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import {
  type CrewAssignment,
  type RotationAnalysis,
  type SuggestionSlot,
} from '../../rotation-suggestion'

type RotationCoveragePanelProps = {
  slots: SuggestionSlot[]
  assignments: CrewAssignment[]
  analysis: RotationAnalysis
  shifts: Shift[]
}

function shiftLetter(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase()
}

// One cell of the grid: the shift a crew works on that day of the cycle, or a
// muted dash for a rest day.
function CoverageCell({ shift, isOff }: { shift?: Shift; isOff: boolean }) {
  if (isOff || !shift) {
    return <span className='font-mono text-xs text-muted-foreground/50'>·</span>
  }

  const color = SHIFT_BADGE_COLOR_OPTIONS.find(
    (option) => option.value === shift.badge_color
  )

  return (
    <span
      title={shift.name}
      className='inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold'
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          color?.swatchClassName ?? 'bg-muted-foreground/40'
        )}
      />
      {shiftLetter(shift.name)}
    </span>
  )
}

// Shows what the current assignment actually produces: who works which card of
// the cycle, and how many crews are on each day.
//
// Driven by whatever is in the form right now rather than by the last
// suggestion, so hand-editing a position updates it immediately and it works
// just as well for someone who never presses Suggest.
//
// `analysis.warnings` is deliberately **not** rendered — the grid itself shows
// the thin days, and a prose list under it repeated one near-identical line per
// shift, which read as a wall of complaints about a correct roster. The
// warnings stay part of `analyzeRotation`'s API (and its tests) for any caller
// that wants them.
export function RotationCoveragePanel({
  slots,
  assignments,
  analysis,
  shifts,
}: RotationCoveragePanelProps) {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const cycleLength = slots.length

  const onDutyCounts = analysis.coverage.map((day) => day.onDuty)
  const minOnDuty = onDutyCounts.length ? Math.min(...onDutyCounts) : 0
  const maxOnDuty = onDutyCounts.length ? Math.max(...onDutyCounts) : 0

  return (
    <div className='space-y-3'>
      {assignments.length > 0 && cycleLength > 0 && (
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='border-b'>
                <th className='sticky start-0 bg-muted/40 px-3 py-2 text-start text-xs font-medium'>
                  Crew
                </th>
                {slots.map((slot) => (
                  <th
                    key={slot.index}
                    className='w-8 px-1 py-2 text-center text-xs font-medium text-muted-foreground tabular-nums'
                  >
                    {slot.index + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map(({ crew, offset }) => (
                <tr key={crew.key} className='border-b last:border-b-0'>
                  <td className='sticky start-0 max-w-40 truncate bg-muted/40 px-3 py-1.5 text-xs font-medium'>
                    {crew.label}
                  </td>
                  {slots.map((_, day) => {
                    const slot =
                      slots[
                        (((day + offset) % cycleLength) + cycleLength) %
                          cycleLength
                      ]
                    const shiftId = slot.isOff
                      ? undefined
                      : (crew.fixedShiftId ?? slot.shiftId)
                    return (
                      <td key={day} className='px-1 py-1.5 text-center'>
                        <CoverageCell
                          shift={shiftId ? shiftById.get(shiftId) : undefined}
                          isOff={slot.isOff}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className='border-t bg-muted/20'>
                <td className='sticky start-0 bg-muted/40 px-3 py-1.5 text-xs font-medium'>
                  On duty
                </td>
                {analysis.coverage.map((day) => (
                  <td
                    key={day.index}
                    className={cn(
                      'px-1 py-1.5 text-center font-mono text-xs tabular-nums',
                      // Only call out the dips and spikes once the cycle
                      // actually varies — a flat rotation should read as calm.
                      minOnDuty !== maxOnDuty &&
                        day.onDuty === minOnDuty &&
                        'text-amber-600 dark:text-amber-400',
                      day.onDuty === 0 && 'font-semibold text-destructive'
                    )}
                  >
                    {day.onDuty}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
