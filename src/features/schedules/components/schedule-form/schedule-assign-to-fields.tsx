import { type RefObject, useEffect, useMemo, useState } from 'react'
import { parse } from 'date-fns'
import { useFormContext, useWatch } from 'react-hook-form'
import { Wand2 } from 'lucide-react'
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
  type RotateDayCoverage,
  type RotatePatternEntry,
} from '../../data/schema'
import {
  cellsFromPlacements,
  crewKeysFromDayCoverage,
  crewsFromDayCoverage,
  orderShiftIdsByStart,
  patternToSlots,
} from '../../rotation-crews'
import {
  type SuggestionCrew,
  analyzeDayCoverage,
  suggestRotationCoverage,
} from '../../rotation-suggestion'
import { RotationCoveragePanel } from './rotation-coverage-panel'

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

  const analysis = useMemo(
    () =>
      analyzeDayCoverage(crews, orderedShiftIds, pattern.length, {
        startDate,
        shiftLabels,
      }),
    [crews, orderedShiftIds, pattern.length, startDate, shiftLabels]
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
      { startDate, shiftLabels }
    )

    // One whole-field write: the matrix the suggestion produced replaces
    // whatever was there, so a crew left over from a previous run cannot stay
    // behind and quietly double-book a cell.
    setValue(
      'day_coverage',
      cellsFromPlacements(
        patternToSlots(currentPattern),
        placements,
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
              <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
                <div className='flex-1'>
                  <MultiSelect
                    options={poolOptions}
                    value={poolOptions.filter((option) =>
                      poolIds.includes(option.value)
                    )}
                    onChange={(selected: Option[]) =>
                      setPoolIds(
                        (selected ?? []).map((option) => option.value)
                      )
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
