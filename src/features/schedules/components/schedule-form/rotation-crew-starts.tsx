import { Info, PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SHIFT_BADGE_COLOR_OPTIONS } from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { type RotateCrewPlacement } from '../../data/schema'
import {
  type CoverageCrew,
  type SuggestionSlot,
  placementShifts,
} from '../../rotation-suggestion'
import { describeStartDay } from '../../utils'

// The two numbers behind a crew's row of the coverage matrix, as something a
// person can read and change: "Team B starts on day 8 — week 2 — on nights".
//
// Every real-world rotation is written that way ("assign Team A to day 1 of
// the template, Team B to day 8"), and until now the schedule could not say
// it: the search's offsets were materialised into `day_coverage` and thrown
// away, so a saved rotation had a roster but no account of how it was built.
// They are stored alongside the matrix now — see `crew_placements` in
// `schedules/data/schema.ts` — with the matrix still the source of truth.
//
// Which means these controls can go out of date, and saying so is half their
// job: a hand edit in the manual grid moves one cell, which no pair of
// offsets can describe. `describesCoverage` is re-derived by regenerating
// from the offsets and comparing, never tracked as a flag, so it cannot claim
// a roster is generated when it is not.

// The shift a crew is actually on when its cycle opens — the first working
// card it lands on, not the first card, so an offset that starts on a rest
// day still names the shift the crew is heading into.
//
// This is what makes the shift-step control legible. The stored number is a
// transposition through the shift list, which means nothing on its own;
// "Team B works nights" is the same fact in the words the user has.
function openingShiftId(
  slots: SuggestionSlot[],
  placement: Pick<RotateCrewPlacement, 'day_offset' | 'shift_step'>,
  orderedShiftIds: string[]
): string | undefined {
  return placementShifts(
    slots,
    { dayOffset: placement.day_offset, shiftStep: placement.shift_step },
    orderedShiftIds
  ).find((shiftId) => shiftId)
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

// Shown wherever the offsets are displayed and they no longer describe the
// stored roster. Deliberately not an error and never destructive-coloured:
// hand-editing a cell is a supported thing to do, and the matrix is still
// exactly what the schedule will run.
function HandEditedNote() {
  return (
    <p className='flex items-start gap-1.5 text-xs text-muted-foreground'>
      <PencilLine className='mt-0.5 size-3.5 shrink-0' />
      <span>
        This roster has been edited by hand, so it is no longer just these start
        days. The grid is what the schedule will run.
      </span>
    </p>
  )
}

type CrewStartEditorProps = {
  placements: RotateCrewPlacement[]
  crewLabels: Map<string, string>
  slots: SuggestionSlot[]
  orderedShiftIds: string[]
  cycleLength: number
  shifts: Shift[]
  describesCoverage: boolean
  disabled?: boolean
  onChange: (next: RotateCrewPlacement[]) => void
}

// One row per crew: which cycle day it starts on, and which shift it opens
// on. Changing either regenerates the whole matrix from every crew's offsets
// — see `applyPlacements` in `schedule-assign-to-fields.tsx` — so the two
// stay consistent by construction rather than by being edited in step.
export function CrewStartEditor({
  placements,
  crewLabels,
  slots,
  orderedShiftIds,
  cycleLength,
  shifts,
  describesCoverage,
  disabled,
  onChange,
}: CrewStartEditorProps) {
  if (placements.length === 0 || cycleLength === 0) return null

  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const shiftCount = Math.max(orderedShiftIds.length, 1)

  const update = (crew: string, patch: Partial<RotateCrewPlacement>) => {
    onChange(
      placements.map((placement) =>
        placement.crew === crew ? { ...placement, ...patch } : placement
      )
    )
  }

  return (
    <div className='space-y-2 rounded-md border bg-muted/20 p-3'>
      <div>
        <p className='text-sm font-medium'>Crew start days</p>
        <p className='mt-0.5 text-xs text-muted-foreground'>
          Every crew runs the same pattern, started on a different day. Move a
          crew here and the grid below is rebuilt from all of them.
        </p>
      </div>

      <div className='space-y-1.5'>
        {placements.map((placement) => {
          const openingId = openingShiftId(slots, placement, orderedShiftIds)
          return (
            <div
              key={placement.crew}
              className='flex flex-wrap items-center gap-2'
              data-testid={`crew-start-${placement.crew}`}
            >
              <span className='min-w-28 flex-1 truncate text-xs font-medium'>
                {crewLabels.get(placement.crew) ?? placement.crew}
              </span>

              <Select
                value={String(placement.day_offset)}
                // Radix re-emits an empty value from its hidden native
                // <select> while it catches up with a programmatically set
                // one — which is every value here, since "Suggest" writes
                // them. Dropping empties is safe: there is no clear
                // affordance, so a real pick is never empty.
                onValueChange={(value) => {
                  if (!value) return
                  update(placement.crew, { day_offset: Number(value) })
                }}
                disabled={disabled}
              >
                <SelectTrigger size='sm' className='w-40'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: cycleLength }, (_, day) => (
                    <SelectItem key={day} value={String(day)}>
                      {describeStartDay(day, cycleLength)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {orderedShiftIds.length > 1 ? (
                <Select
                  value={String(placement.shift_step)}
                  onValueChange={(value) => {
                    if (!value) return
                    update(placement.crew, { shift_step: Number(value) })
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger size='sm' className='w-40'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: shiftCount }, (_, step) => {
                      // Labelled by the shift this step actually puts the
                      // crew on, not by the number stored. The number is a
                      // transposition through the shift list and means
                      // nothing to anyone building a roster.
                      const id = openingShiftId(
                        slots,
                        { ...placement, shift_step: step },
                        orderedShiftIds
                      )
                      const shift = id ? shiftById.get(id) : undefined
                      return (
                        <SelectItem key={step} value={String(step)}>
                          <span className='flex items-center gap-1.5'>
                            <ShiftSwatch shift={shift} />
                            {shift?.name ?? `Shift track ${step + 1}`}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              ) : (
                openingId && (
                  <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <ShiftSwatch shift={shiftById.get(openingId)} />
                    {shiftById.get(openingId)?.name ?? 'Unknown shift'}
                  </span>
                )
              )}
            </div>
          )
        })}
      </div>

      {!describesCoverage && <HandEditedNote />}
    </div>
  )
}

type CrewStartSummaryProps = {
  placements: RotateCrewPlacement[]
  crews: CoverageCrew[]
  cycleLength: number
  shifts: Shift[]
  describesCoverage: boolean
}

// The same fact, read-only, on the Summary step. A roster assembled as "each
// crew a week apart" should still say so where somebody signs it off — the
// coverage grid proves it is covered, but not how it was meant to be read.
export function CrewStartSummary({
  placements,
  crews,
  cycleLength,
  shifts,
  describesCoverage,
}: CrewStartSummaryProps) {
  if (cycleLength === 0) return null

  // Nothing to report rather than something wrong: a roster built entirely by
  // hand never had start days, and the grid below says everything about it.
  if (placements.length === 0) {
    return (
      <p className='flex items-start gap-1.5 text-xs text-muted-foreground'>
        <Info className='mt-0.5 size-3.5 shrink-0' />
        <span>
          This roster was set by hand rather than generated from crew start
          days.
        </span>
      </p>
    )
  }

  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]))
  const crewLabels = new Map(crews.map((crew) => [crew.key, crew.label]))

  return (
    <div className='space-y-1.5'>
      <p className='text-xs font-medium text-muted-foreground'>
        Crew start days
      </p>
      <ul className='space-y-0.5'>
        {placements.map((placement) => {
          // Read the opening shift off the crew's own row of the stored
          // matrix rather than recomputing it from the offsets: after a hand
          // edit the offsets no longer describe the roster, and the shift in
          // the grid is the one that will actually be worked.
          const crew = crews.find((entry) => entry.key === placement.crew)
          const openingId = crew
            ? [...crew.byDay.entries()].sort((a, b) => a[0] - b[0])[0]?.[1][0]
            : undefined
          const shift = openingId ? shiftById.get(openingId) : undefined

          return (
            <li
              key={placement.crew}
              className='flex flex-wrap items-center gap-x-2 text-xs'
            >
              <span className='font-medium'>
                {crewLabels.get(placement.crew) ?? placement.crew}
              </span>
              <span className='text-muted-foreground'>
                starts{' '}
                {describeStartDay(
                  placement.day_offset,
                  cycleLength
                ).toLowerCase()}
              </span>
              {shift && (
                <span className='flex items-center gap-1.5 text-muted-foreground'>
                  <ShiftSwatch shift={shift} />
                  {shift.name}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {!describesCoverage && <HandEditedNote />}
    </div>
  )
}
