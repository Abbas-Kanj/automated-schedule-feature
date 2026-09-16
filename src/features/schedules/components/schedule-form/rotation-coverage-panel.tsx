import { type ReactNode } from 'react'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { type Shift } from '@/features/shifts/data/schema'
import {
  type RotationAnalysis,
  type SuggestionWarning,
} from '../../rotation-suggestion'

type RotationCoveragePanelProps = {
  analysis: RotationAnalysis
  orderedShiftIds: string[]
  cycleLength: number
  shifts: Shift[]
  // Column headers (real dates) instead of cycle-day numbers.
  dayLabels?: string[]
  // Rendered between the coverage grid and the warnings — the per-person
  // roster, so it reads next to the numbers it explains.
  children?: ReactNode
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

// The only place a coverage hole is reported: leaving a shift unstaffed is a
// warning, not a validation error, so "Next" always advances and this panel
// carries the message. The grid's shift rows show whether every selected
// shift is covered every day, driven by live form state so a hand edit
// updates it immediately.
export function RotationCoveragePanel({
  analysis,
  orderedShiftIds,
  cycleLength,
  shifts,
  dayLabels,
  children,
}: RotationCoveragePanelProps) {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const days = Array.from({ length: cycleLength }, (_, day) => day)

  const onDutyCounts = analysis.coverage.map((day) => day.onDuty)
  const minOnDuty = onDutyCounts.length ? Math.min(...onDutyCounts) : 0
  const maxOnDuty = onDutyCounts.length ? Math.max(...onDutyCounts) : 0

  // `info`-severity warnings are hidden except the two kinds that explain
  // something already on screen: an unstaffed shift (the red 0 above) and
  // weekday alignment (the start date lives on a different step). The
  // nobody-in-today line stays hidden — the "On duty" row already shows the
  // zero. `analysis.warnings` still carries every line for callers/tests.
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
                  className='min-w-12 px-1 py-2 text-center text-[11px] leading-tight font-medium text-muted-foreground tabular-nums'
                >
                  {dayLabels?.[day] ?? day + 1}
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
                    // Only call out dips once the cycle actually varies.
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

      {children}

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
