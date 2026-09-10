import { type RefObject, useEffect, useMemo, useState } from 'react'
import { parse } from 'date-fns'
import { useFormContext, useWatch } from 'react-hook-form'
import { CheckCircle2, TriangleAlert, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MultiSelect } from '@/components/multi-select'
import { ToggleButton } from '@/components/toggle-button'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { SHIFT_BADGE_COLOR_OPTIONS } from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import {
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type RotatePatternEntry,
} from '../../data/schema'
import {
  cellsFromCrewPlacements,
  crewKeysFromDayCoverage,
  crewPlacementsToStored,
  crewsFromDayCoverage,
  dayCoverageMatchesPlacements,
  orderShiftIdsByStart,
  patternToSlots,
  shiftHoursById,
} from '../../rotation-crews'
import {
  type CrewRequirement,
  type SuggestionCrew,
  analyzeDayCoverage,
  crewRequirement,
  suggestRotationCoverage,
} from '../../rotation-suggestion'
import { RotationCoveragePanel } from './rotation-coverage-panel'
import { CrewStartEditor } from './rotation-crew-starts'

type Option = { value: string; label: string }

type CrewKind = 'team' | 'employee'

type ScheduleAssignToFieldsProps = {
  disabled?: boolean
  // Filled in by this step, called by the wizard's "Next" button — see
  // `commitPendingSuggestion` below.
  commitRef?: RefObject<(() => void) | null>
}

// "Assign to" step of a rotate schedule (after "Pattern" — see
// `schedule-form.tsx`'s step list). Answers one question: **who covers each
// selected shift on each day of the cycle?**
//
// The pattern from the previous step is a template, not the answer — it
// describes one crew's journey ("Morning, Morning, off, Afternoon"), and the
// suggestion transposes copies of that journey across the crews so every
// selected shift ends up staffed every day (see `rotation-suggestion.ts`).
// What gets stored is the resolved matrix, `day_coverage`, not the offsets
// behind it, because the manual grid below edits single cells freely.
//
// Hand-assignment stays available behind a toggle for the rosters the search
// cannot express — it is the escape hatch, not the default path.
//
// Shifts keep their own "Assign to" tab (see
// `features/shifts/components/shift-form/assign-to-tab.tsx`) — that says who
// may work a shift in general, which is a different question from who covers
// which day of this particular rotation.
export function ScheduleAssignToFields({
  disabled,
  commitRef,
}: ScheduleAssignToFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues, setValue } = useFormContext<any>()
  const patternRaw = useWatch({ control, name: 'pattern' }) as
    | RotatePatternEntry[]
    | undefined
  // Memoised because the coverage analysis below keys off it — a fresh `[]`
  // every render would re-run the whole grid on every keystroke elsewhere in
  // the form. Same idiom `pattern-builder.tsx` uses for `shift_repeat`.
  const pattern = useMemo(() => patternRaw ?? [], [patternRaw])
  const coverageRaw = useWatch({ control, name: 'day_coverage' }) as
    | RotateDayCoverage[]
    | undefined
  const dayCoverage = useMemo(() => coverageRaw ?? [], [coverageRaw])
  const placementsRaw = useWatch({ control, name: 'crew_placements' }) as
    | RotateCrewPlacement[]
    | undefined
  const crewPlacements = useMemo(() => placementsRaw ?? [], [placementsRaw])
  const shiftIdsRaw = useWatch({ control, name: 'shift_ids' }) as
    | string[]
    | undefined
  const shiftIds = useMemo(() => shiftIdsRaw ?? [], [shiftIdsRaw])
  const startDateValue = useWatch({ control, name: 'start_date' }) as
    | string
    | undefined

  const shifts = useShiftsStore((s) => s.shifts)
  const employees = useEmployeesStore((s) => s.employees)
  const teams = useTeamsStore((s) => s.teams)

  const employeeOptions = useMemo<Option[]>(
    () =>
      employees
        .filter((employee) => employee.id)
        .map((employee) => ({
          value: employee.id as string,
          label: getEmployeeFullName(employee),
        })),
    [employees]
  )

  const teamOptions = useMemo<Option[]>(
    () => teams.map((team) => ({ value: team.id, label: team.name })),
    [teams]
  )

  const employeeLabels = useMemo(
    () =>
      new Map(employeeOptions.map((option) => [option.value, option.label])),
    [employeeOptions]
  )

  // Clock order, earliest shift first — a crew stepping one along moves
  // forward through the day. See `orderShiftIdsByStart`.
  const orderedShiftIds = useMemo(
    () => orderShiftIdsByStart(shiftIds, shifts),
    [shiftIds, shifts]
  )

  const shiftLabels = useMemo(
    () => new Map(shifts.map((shift) => [shift.id, shift.name])),
    [shifts]
  )

  // Real clock times, which is what turns "Night then Morning" into a number
  // of hours off. Feeds both the search — as a tie-break between rosters that
  // are otherwise equally covered — and the warning below it.
  const shiftHours = useMemo(() => shiftHoursById(shifts), [shifts])

  // Labels for every crew that could appear in a placement, both kinds at
  // once: a saved schedule can hold team placements while the step is showing
  // the employee pool, and an unlabelled row would read as a bug.
  const crewLabels = useMemo(() => {
    const labels = new Map<string, string>()
    teams.forEach((team) => labels.set(`team:${team.id}`, team.name))
    employeeOptions.forEach((option) =>
      labels.set(`employee:${option.value}`, option.label)
    )
    return labels
  }, [teams, employeeOptions])

  // The crew pool is deliberately not a form field. The union of what is
  // already assigned *is* the pool, so it round-trips through a saved schedule
  // without adding anything to the schema. This component unmounts when the
  // wizard leaves the step, so returning to it re-derives from the matrix.
  const [crewKind, setCrewKind] = useState<CrewKind>(() => {
    const keys = crewKeysFromDayCoverage(dayCoverage)
    if (keys.some((key) => key.startsWith('team:'))) return 'team'
    if (keys.some((key) => key.startsWith('employee:'))) return 'employee'
    return teamOptions.length > 0 ? 'team' : 'employee'
  })

  const [poolIds, setPoolIds] = useState<string[]>(() => {
    const keys = crewKeysFromDayCoverage(dayCoverage)
    const teamIds = keys
      .filter((key) => key.startsWith('team:'))
      .map((key) => key.slice('team:'.length))
    if (teamIds.length) return teamIds
    return keys
      .filter((key) => key.startsWith('employee:'))
      .map((key) => key.slice('employee:'.length))
  })

  const [manualMode, setManualMode] = useState(false)

  const crews = useMemo(
    () => crewsFromDayCoverage(dayCoverage, teams, employeeLabels),
    [dayCoverage, teams, employeeLabels]
  )

  const startDate = useMemo(() => {
    if (!startDateValue) return undefined
    const parsed = parse(startDateValue, 'yyyy-MM-dd', new Date())
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [startDateValue])

  // What the pool needs to be *before* anything is placed — see
  // `crewRequirement`. Derived from the pattern and the selected shifts only,
  // so it is already on screen when the pool is still empty. Deliberately not
  // keyed on the pool: it answers what this pattern needs, not what has been
  // picked, and re-running the probe on every pick would be wasted work.
  const requirement = useMemo(
    () => crewRequirement(patternToSlots(pattern), orderedShiftIds),
    [pattern, orderedShiftIds]
  )

  const analysis = useMemo(
    () =>
      analyzeDayCoverage(crews, orderedShiftIds, pattern.length, {
        startDate,
        shiftLabels,
        shiftHours,
        // Without this the panel can tell someone who has just pressed
        // Suggest that there are enough crews and to press it again.
        minimumCrews: requirement.exact ? requirement.minimumCrews : undefined,
      }),
    [
      crews,
      orderedShiftIds,
      pattern.length,
      startDate,
      shiftLabels,
      shiftHours,
      requirement,
    ]
  )

  // Do the stored start days still describe the stored matrix? Re-derived
  // rather than flagged — see `dayCoverageMatchesPlacements`. False after any
  // edit in the manual grid, which is exactly when the editor must stop
  // presenting itself as a description of the roster.
  const placementsDescribeCoverage = useMemo(
    () =>
      dayCoverageMatchesPlacements(
        patternToSlots(pattern),
        crewPlacements,
        orderedShiftIds,
        dayCoverage
      ),
    [pattern, crewPlacements, orderedShiftIds, dayCoverage]
  )

  const poolOptions = crewKind === 'team' ? teamOptions : employeeOptions

  function applySuggestion() {
    const currentPattern =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    if (currentPattern.length === 0) return

    const suggestionCrews = poolIds.flatMap<SuggestionCrew>((id) => {
      if (crewKind === 'team') {
        const team = teams.find((t) => t.id === id)
        return team
          ? [
              {
                key: `team:${id}`,
                kind: 'team',
                label: team.name,
                employeeIds: team.employee_ids,
              },
            ]
          : []
      }
      const label = employeeLabels.get(id)
      return label
        ? [
            {
              key: `employee:${id}`,
              kind: 'employee',
              label,
              employeeIds: [id],
            },
          ]
        : []
    })

    if (suggestionCrews.length === 0) return

    const { placements } = suggestRotationCoverage(
      patternToSlots(currentPattern),
      suggestionCrews,
      orderedShiftIds,
      { startDate, shiftLabels, shiftHours }
    )

    applyPlacements(crewPlacementsToStored(placements))
  }

  // The one place both halves of the roster are written, so they cannot drift
  // apart. The matrix is regenerated from the start days every time rather
  // than patched, which is what makes moving one crew safe: nothing survives
  // from the previous arrangement to double-book a cell.
  //
  // Both are whole-field writes for the same reason — a crew dropped from the
  // pool has to disappear from the matrix too, and merging would leave it
  // behind.
  function applyPlacements(next: RotateCrewPlacement[]) {
    const currentPattern =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    if (currentPattern.length === 0) return

    setValue('crew_placements', next, { shouldDirty: true })
    setValue(
      'day_coverage',
      cellsFromCrewPlacements(
        patternToSlots(currentPattern),
        next,
        orderedShiftIds
      ),
      { shouldDirty: true }
    )
  }

  // Does the matrix already hold exactly the pool the user picked? Equal sets
  // mean the roster on screen *is* this pool's assignment — because "Suggest
  // assignment" was pressed, or because it arrived that way from a saved
  // schedule.
  const poolCrewKeys = poolIds.map((id) => `${crewKind}:${id}`)
  const placedCrewKeys = new Set(crews.map((crew) => crew.key))
  const coverageMatchesPool =
    poolCrewKeys.length === placedCrewKeys.size &&
    poolCrewKeys.every((key) => placedCrewKeys.has(key))

  // "Next" accepts what this step is showing.
  //
  // Pressing "Suggest assignment" writes its matrix straight into
  // `day_coverage` already, so on the ordinary path this is a no-op. It exists
  // for the two ways of leaving the step with the suggestion only half-taken:
  // picking a pool and continuing without ever pressing the button, and
  // changing the pool after pressing it. Both used to advance with a roster
  // that did not match what the user had selected, and nothing on the
  // following steps says so — the Summary just lists whoever was assigned.
  //
  // Manual mode is left strictly alone: it is the escape hatch for rosters the
  // search cannot express, so re-running the search over hand-placed crew
  // would throw away the exact work the toggle exists to allow.
  function commitPendingSuggestion() {
    if (manualMode || poolIds.length === 0 || coverageMatchesPool) return
    applySuggestion()
  }

  // No dependency list on purpose — the callback closes over the pool and the
  // matrix, so the form has to be handed a fresh one after every render.
  useEffect(() => {
    if (!commitRef) return
    commitRef.current = commitPendingSuggestion
    return () => {
      commitRef.current = null
    }
  })

  if (pattern.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Build the pattern in the previous step to assign crew to it.
      </p>
    )
  }

  return (
    <div className='space-y-4'>
      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-base font-semibold'>
            Who is on this rotation
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4 px-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <ToggleButton
              size='sm'
              selected={crewKind === 'team'}
              disabled={disabled || teamOptions.length === 0}
              onClick={() => {
                setCrewKind('team')
                setPoolIds([])
              }}
            >
              Teams
            </ToggleButton>
            <ToggleButton
              size='sm'
              selected={crewKind === 'employee'}
              disabled={disabled}
              onClick={() => {
                setCrewKind('employee')
                setPoolIds([])
              }}
            >
              Employees
            </ToggleButton>
            <span className='text-xs text-muted-foreground'>
              {crewKind === 'team'
                ? 'A team rotates together as one crew.'
                : 'Each employee is their own crew.'}
            </span>
          </div>

          {/* One view at a time: the suggestion controls or the manual grid,
              never both. Coverage grading sits below and applies to whichever
              is showing. */}
          <div className='flex flex-wrap items-center gap-2'>
            <ToggleButton
              size='sm'
              selected={!manualMode}
              disabled={disabled}
              onClick={() => setManualMode(false)}
            >
              Suggest
            </ToggleButton>
            <ToggleButton
              size='sm'
              selected={manualMode}
              disabled={disabled}
              onClick={() => setManualMode(true)}
            >
              Assign manually
            </ToggleButton>
          </div>

          {!manualMode ? (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Pick the crews, then let the suggestion stagger them across the
                cycle — it reuses the pattern&apos;s rhythm and moves each crew
                along the shift list so every selected shift is covered every
                day.
              </p>
              <CrewRequirementNote
                requirement={requirement}
                cycleLength={pattern.length}
                shiftCount={orderedShiftIds.length}
                selectedCount={poolIds.length}
                crewKind={crewKind}
              />
              <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
                <div className='flex-1'>
                  <MultiSelect
                    options={poolOptions}
                    value={poolOptions.filter((option) =>
                      poolIds.includes(option.value)
                    )}
                    onChange={(selected: Option[]) =>
                      setPoolIds((selected ?? []).map((option) => option.value))
                    }
                    isMulti
                    placeholder={
                      crewKind === 'team'
                        ? teamOptions.length
                          ? 'Select teams'
                          : 'No teams yet — create one first'
                        : 'Select employees'
                    }
                    isDisabled={disabled || poolOptions.length === 0}
                  />
                </div>
                <Button
                  type='button'
                  onClick={applySuggestion}
                  disabled={disabled || poolIds.length === 0}
                  className='shrink-0'
                >
                  <Wand2 className='me-1 size-4' />
                  Suggest assignment
                </Button>
              </div>

              {/* Only once there is something to describe. Before the first
                  Suggest there are no start days, and an editor full of
                  day 1s would invent a roster nobody asked for. */}
              <CrewStartEditor
                placements={crewPlacements}
                crewLabels={crewLabels}
                slots={patternToSlots(pattern)}
                orderedShiftIds={orderedShiftIds}
                cycleLength={pattern.length}
                shifts={shifts}
                describesCoverage={placementsDescribeCoverage}
                disabled={disabled}
                onChange={applyPlacements}
              />
            </div>
          ) : (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Staff each shift on each cycle day yourself — for the rosters
                the suggestion cannot express. One card per cycle day, one row
                per selected shift; an empty row is a shift nobody is covering
                that day. The grid below keeps grading whatever you set.
              </p>
              <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                {pattern.map((entry, index) => (
                  <ManualDayCard
                    key={entry.position ?? index}
                    day={index}
                    orderedShiftIds={orderedShiftIds}
                    crewKind={crewKind}
                    crewOptions={
                      crewKind === 'team' ? teamOptions : employeeOptions
                    }
                    dayCoverage={dayCoverage}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          )}

          <RotationCoveragePanel
            crews={crews}
            analysis={analysis}
            orderedShiftIds={orderedShiftIds}
            cycleLength={pattern.length}
            shifts={shifts}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

type CrewRequirementNoteProps = {
  requirement: CrewRequirement
  cycleLength: number
  shiftCount: number
  selectedCount: number
  crewKind: CrewKind
}

// The headline number for this step: how many crews the pattern needs before
// full coverage is even arithmetically possible.
//
// It is shown while the pool is still empty, which is the whole point — the
// coverage panel below can only report a shortfall once crews are placed, and
// by then the user has already made the choice this would have informed. The
// arithmetic is spelled out because the number is otherwise surprising: two
// crews on a 5-2 with two shifts is 10 crew-days against 14 cells, so four
// cells stay empty no matter who is placed where.
//
// Being under the minimum is a fact about the pattern, not a mistake — same
// rule the warnings follow — so this never blocks anything and never uses the
// destructive colour.
function CrewRequirementNote({
  requirement,
  cycleLength,
  shiftCount,
  selectedCount,
  crewKind,
}: CrewRequirementNoteProps) {
  const { workDaysPerCrew, cellsPerCycle, minimumCrews } = requirement
  // An all-off pattern or no selected shifts: there is no grid to size a pool
  // against, and the previous steps already say so.
  if (minimumCrews === 0 || shiftCount === 0) return null

  const unit = crewKind === 'team' ? 'team' : 'employee'
  const short = minimumCrews - selectedCount
  // Only a demonstrated requirement licenses the green line — see
  // `CrewRequirement.exact`. Promising full coverage and then showing a red 0
  // is the exact failure this note exists to prevent.
  const enough = requirement.exact && short <= 0

  return (
    <div
      className='rounded-md border bg-muted/30 p-3 text-xs'
      data-testid='crew-requirement-note'
    >
      <p className='text-sm font-medium'>
        Covering every shift every day needs{' '}
        {requirement.exact ? '' : 'more than '}
        {plural(minimumCrews, unit)}.
      </p>
      <p className='mt-1 text-muted-foreground'>
        {plural(shiftCount, 'shift')} over {plural(cycleLength, 'cycle day')} is{' '}
        {plural(cellsPerCycle, 'crew-day')} to fill; each crew works{' '}
        {plural(workDaysPerCrew, 'day')} of this pattern, and can only be on one
        shift a day.
      </p>
      <p
        className={cn(
          'mt-1.5 flex items-center gap-1.5 font-medium',
          selectedCount === 0
            ? 'text-muted-foreground'
            : enough
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
        )}
      >
        {selectedCount > 0 &&
          (enough ? (
            <CheckCircle2 className='size-3.5 shrink-0' />
          ) : (
            <TriangleAlert className='size-3.5 shrink-0' />
          ))}
        {selectedCount === 0
          ? `No ${unit}s picked yet.`
          : enough
            ? `${plural(selectedCount, unit)} picked — enough to cover every shift on every cycle day.`
            : short > 0
              ? `${plural(selectedCount, unit)} picked — ${short} short, so some shifts stay empty on some days whichever way they are placed.`
              : `${plural(selectedCount, unit)} picked — this pattern may still leave gaps; the grid below shows what the suggestion manages.`}
      </p>
    </div>
  )
}

type ManualDayCardProps = {
  day: number
  orderedShiftIds: string[]
  crewKind: CrewKind
  crewOptions: Option[]
  dayCoverage: RotateDayCoverage[]
  disabled?: boolean
}

// One cycle day: every selected shift gets its own picker, so a hole is a
// visibly empty field rather than something you have to infer from the grid
// above.
//
// Cells are edited freely — putting a crew on a shift here does not move it
// anywhere else, which is the whole point of storing the matrix rather than a
// pair of offsets per crew. Only the crew kind picked above is offered, never
// both at once.
function ManualDayCard({
  day,
  orderedShiftIds,
  crewKind,
  crewOptions,
  dayCoverage,
  disabled,
}: ManualDayCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getValues, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)

  // Written straight through `setValue` rather than through a `FormField` per
  // cell: the stored array is sparse, so a cell has no stable index to
  // register a controller against — clearing one cell would renumber every
  // field name after it.
  const setCell = (shiftId: string, ids: string[]) => {
    const current =
      (getValues('day_coverage') as RotateDayCoverage[] | undefined) ?? []
    const key = crewKind === 'team' ? 'team_ids' : 'employee_ids'
    const existing = current.find(
      (cell) => cell.day === day && cell.shift_id === shiftId
    )

    const next = existing
      ? current.map((cell) =>
          cell === existing ? { ...cell, [key]: ids } : cell
        )
      : [
          ...current,
          {
            day,
            shift_id: shiftId,
            employee_ids: [],
            team_ids: [],
            [key]: ids,
          } as RotateDayCoverage,
        ]

    setValue(
      'day_coverage',
      // Drop cells nobody is on, so an emptied picker leaves no trace and
      // "no cell" and "empty cell" keep meaning the same thing.
      next.filter((cell) => cell.employee_ids.length || cell.team_ids.length),
      { shouldDirty: true }
    )
  }

  return (
    <Card className='gap-1 py-2' data-testid={`assign-day-${day}`}>
      <CardContent className='space-y-1.5 px-2'>
        <p className='text-center text-xs font-medium text-muted-foreground'>
          Day {day + 1}
        </p>

        {orderedShiftIds.map((shiftId) => {
          const shift = shifts.find((s) => s.id === shiftId)
          const color = SHIFT_BADGE_COLOR_OPTIONS.find(
            (option) => option.value === shift?.badge_color
          )
          const cell = dayCoverage.find(
            (entry) => entry.day === day && entry.shift_id === shiftId
          )
          const ids =
            (crewKind === 'team' ? cell?.team_ids : cell?.employee_ids) ?? []

          return (
            <div key={shiftId} className='space-y-0.5'>
              <span className='flex items-center gap-1 text-[10px] text-muted-foreground'>
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    color?.swatchClassName ?? 'bg-muted-foreground/40'
                  )}
                />
                {shift?.name ?? 'Unknown shift'}
              </span>
              {/* Keyed on the crew kind: without it, flipping
                  Teams/Employees while the grid is open leaves the picker
                  holding the other kind's ids and writes them to the wrong
                  field. Remounting reads the new one instead. */}
              <MultiSelect
                key={crewKind}
                options={crewOptions}
                value={crewOptions.filter((option) =>
                  ids.includes(option.value)
                )}
                onChange={(selected: Option[]) =>
                  setCell(
                    shiftId,
                    (selected ?? []).map((option) => option.value)
                  )
                }
                isMulti
                compactHeight
                placeholder={crewKind === 'team' ? 'Team' : 'Employee'}
                isDisabled={disabled || crewOptions.length === 0}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
