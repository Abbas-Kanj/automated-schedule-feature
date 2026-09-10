import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SHIFT_BADGE_COLOR_OPTIONS } from '@/features/shifts/data/data'
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

function ShiftSwatch({ shift }: { shift?: Shift }) {
  const color = SHIFT_BADGE_COLOR_OPTIONS.find(
    (option) => option.value === shift?.badge_color
  )
  return (
    <span
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        color?.swatchClassName ?? 'bg-muted-foreground/40'
      )}
    />
  )
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
// place a coverage hole is reported: leaving a shift unstaffed is deliberately
// not a validation error (whether a hole is fixable depends on the crew count,
// not the shape of the data), so "Next" always advances and this panel has to
// carry the whole message.
//
// Two grids, because they answer different questions. The shift rows answer
// "is every selected shift covered every day", which is the rule the feature
// now exists to keep. The crew rows below answer "what does each crew's week
// look like", which is what you read before deciding a roster is humane.
//
// Driven by whatever is in the form right now rather than by the last
// suggestion, so a hand edit updates it immediately and it works just as well
// for someone who never presses Suggest.
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

  // Every line that flags something to act on, plus the 'info' notes that
  // explain something already visible on screen and would otherwise go
  // unaccounted for:
  //
  //   - an unstaffed shift, which drops to 'info' precisely when no
  //     assignment can fix it — exactly when the red 0 in the grid above most
  //     needs explaining;
  //   - the weekday notes, which say how the cycle lands on real dates. A
  //     14-day pattern read Monday-first behaves differently from the same
  //     pattern started on a Wednesday, and the start date is set two steps
  //     away where nothing connects the two.
  //
  // What stays hidden is the nobody-in-today line for an office week: the
  // "On duty" row already shows the zero, and the grid is not lying about it.
  // `analysis.warnings` still carries every line for callers and tests.
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
