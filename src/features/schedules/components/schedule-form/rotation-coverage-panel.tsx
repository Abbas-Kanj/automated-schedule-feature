import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { type Shift } from '@/features/shifts/data/schema'
import {
  type CoverageCrew,
  type RotationAnalysis,
  type SuggestionWarning,
} from '../../rotation-suggestion'

type RotationCoveragePanelProps = {
  crews: CoverageCrew[]
  analysis: RotationAnalysis
  orderedShiftIds: string[]
  cycleLength: number
  shifts: Shift[]
}

function shiftLetter(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase()
}

const SHOWN_INFO_CODES = new Set<SuggestionWarning['code']>([
  'uncovered-shift',
  'weekday-anchor',
  'weekday-drift',
])

const WARNING_STYLES: Record<
  SuggestionWarning['severity'],
  { icon: typeof Info; className: string }
> = {
  error: { icon: OctagonAlert, className: 'text-destructive' },
  warning: {
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  info: { icon: Info, className: 'text-muted-foreground' },
}

// Shows what the current assignment actually produces, and it is the *only*
// place a coverage hole is reported: leaving a shift unstaffed is not a
// validation error (whether a hole is fixable depends on the crew count, not on
// the shape of the data), so "Next" always advances and this panel carries the
// whole message.
//
// Two grids, answering different questions: the shift rows say whether every
// selected shift is covered every day, the crew rows say what each crew's week
// looks like. Both are driven by what is in the form right now rather than by
// the last suggestion, so a hand edit updates them immediately.
export function RotationCoveragePanel({
  crews,
  analysis,
  orderedShiftIds,
  cycleLength,
  shifts,
}: RotationCoveragePanelProps) {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const days = Array.from({ length: cycleLength }, (_, day) => day)

  const onDutyCounts = analysis.coverage.map((day) => day.onDuty)
  const minOnDuty = onDutyCounts.length ? Math.min(...onDutyCounts) : 0
  const maxOnDuty = onDutyCounts.length ? Math.max(...onDutyCounts) : 0

  // Everything to act on, plus the `info` notes that explain something already
  // visible: an unstaffed shift (which drops to `info` precisely when no
  // assignment can fix it, so the red 0 above needs explaining) and the weekday
  // notes (the start date is set two steps away, where nothing connects them).
  // The nobody-in-today line stays hidden — the "On duty" row already shows the
  // zero. `analysis.warnings` still carries every line for callers and tests.
  const shownWarnings = analysis.warnings.filter(
    (warning) =>
      warning.severity !== 'info' || SHOWN_INFO_CODES.has(warning.code)
  )

  if (cycleLength === 0 || orderedShiftIds.length === 0) return null

  return (
    <div className='space-y-3'>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full border-collapse text-sm'>
          <thead>
            <tr className='border-b'>
              <th className='sticky start-0 bg-muted/40 px-3 py-2 text-start text-xs font-medium'>
                Shift
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className='w-8 px-1 py-2 text-center text-xs font-medium text-muted-foreground tabular-nums'
                >
                  {day + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedShiftIds.map((shiftId) => {
              const shift = shiftById.get(shiftId)
              return (
                <tr key={shiftId} className='border-b last:border-b-0'>
                  <td className='sticky start-0 max-w-40 truncate bg-muted/40 px-3 py-1.5 text-xs font-medium'>
                    <span className='inline-flex items-center gap-1.5'>
                      <ShiftSwatch shift={shift} />
                      {shift?.name ?? 'Unknown shift'}
                    </span>
                  </td>
                  {analysis.coverage.map((day) => {
                    const count = day.byShiftId[shiftId] ?? 0
                    return (
                      <td
                        key={day.index}
                        className={cn(
                          'px-1 py-1.5 text-center font-mono text-xs tabular-nums',
                          count === 0 && 'font-semibold text-destructive'
                        )}
                      >
                        {count}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
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
                    // Only call out the dips once the cycle actually varies —
                    // a flat rotation should read as calm.
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

      {crews.length > 0 && (
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full border-collapse text-sm'>
            <thead>
              <tr className='border-b'>
                <th className='sticky start-0 bg-muted/40 px-3 py-2 text-start text-xs font-medium'>
                  Crew
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className='w-8 px-1 py-2 text-center text-xs font-medium text-muted-foreground tabular-nums'
                  >
                    {day + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crews.map((crew) => (
                <tr key={crew.key} className='border-b last:border-b-0'>
                  <td className='sticky start-0 max-w-40 truncate bg-muted/40 px-3 py-1.5 text-xs font-medium'>
                    {crew.label}
                  </td>
                  {days.map((day) => {
                    const worked = crew.byDay.get(day) ?? []
                    if (worked.length === 0) {
                      return (
                        <td key={day} className='px-1 py-1.5 text-center'>
                          <span className='font-mono text-xs text-muted-foreground/50'>
                            ·
                          </span>
                        </td>
                      )
                    }
                    return (
                      <td key={day} className='px-1 py-1.5 text-center'>
                        <span
                          title={worked
                            .map((id) => shiftById.get(id)?.name ?? id)
                            .join(', ')}
                          className={cn(
                            'inline-flex items-center justify-center gap-1 font-mono text-xs font-semibold',
                            // Two shifts on one day is only reachable by hand,
                            // and it is a mistake — say so in place.
                            worked.length > 1 && 'text-destructive'
                          )}
                        >
                          <ShiftSwatch shift={shiftById.get(worked[0])} />
                          {worked
                            .map((id) =>
                              shiftLetter(shiftById.get(id)?.name ?? '?')
                            )
                            .join('/')}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shownWarnings.length > 0 && (
        <ul className='space-y-1.5'>
          {shownWarnings.map((warning, index) => {
            const { icon: Icon, className } = WARNING_STYLES[warning.severity]
            return (
              <li
                key={`${warning.code}-${index}`}
                className={cn('flex gap-2 text-xs', className)}
              >
                <Icon className='mt-0.5 size-3.5 shrink-0' />
                <span>{warning.message}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
