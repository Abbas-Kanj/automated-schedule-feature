import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { format, parse } from 'date-fns'
import { useFormContext, useWatch } from 'react-hook-form'
import { CalendarClock, CheckCircle2, TriangleAlert, Wand2 } from 'lucide-react'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MultiSelect } from '@/components/multi-select'
import { ToggleButton } from '@/components/toggle-button'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { ScheduleRotationTable } from '@/features/schedule-rotation/components/schedule-rotation-table'
import {
  type RotateSchedule,
  buildRotation,
  cycleDayDates,
  getAdvanceType,
} from '@/features/schedule-rotation/utils'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import {
  type EndSettings,
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type RotatePatternEntry,
  dateStringSchema,
  endSettingsSchema,
} from '../../data/schema'
import {
  cellsFromCrewPlacements,
  crewKeysFromDayCoverage,
  crewPlacementsToStored,
  crewsFromDayCoverage,
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

type Option = { value: string; label: string }

type CrewKind = 'team' | 'employee'

type ScheduleAssignToFieldsProps = {
  // The stored record; the form's live values are laid over it so the
  // rotation maths runs on what's on screen.
  schedule: RotateSchedule
  disabled?: boolean
  // Called before saving — see `commitPendingSuggestion`.
  commitRef?: RefObject<(() => void) | null>
  // The start date + end settings fields, placed between the crew pick and
  // the suggestion: the dates have to be set before anything can be placed.
  startEnd?: ReactNode
}

// Who covers each selected shift on each day of the cycle. The pattern is a
// template, not the answer — suggestion transposes copies of that journey
// across crews so every shift is staffed every day. What's stored is the
// resolved `day_coverage` matrix, not the offsets, because the manual grid
// edits single cells freely; hand-assignment is the escape hatch for rosters
// the search can't express.
export function ScheduleAssignToFields({
  schedule,
  disabled,
  commitRef,
  startEnd,
}: ScheduleAssignToFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues, setValue } = useFormContext<any>()
  const patternRaw = useWatch({ control, name: 'pattern' }) as
    | RotatePatternEntry[]
    | undefined
  // Memoised so a fresh `[]` doesn't re-run the coverage analysis every render.
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
  const endSettings = useWatch({ control, name: 'end_settings' }) as
    | EndSettings
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

  // Clock order, earliest first, so a crew stepping one along moves forward
  // through the day.
  const orderedShiftIds = useMemo(
    () => orderShiftIdsByStart(shiftIds, shifts),
    [shiftIds, shifts]
  )

  const shiftLabels = useMemo(
    () => new Map(shifts.map((shift) => [shift.id, shift.name])),
    [shifts]
  )

  // Real clock times, so "Night then Morning" becomes a number of hours off.
  // Feeds the search as a tie-break, and the rest-guardrail warning.
  const shiftHours = useMemo(() => shiftHoursById(shifts), [shifts])

  // Not a form field: the union of what's already assigned *is* the pool, so
  // it round-trips through a saved schedule without adding to the schema.
  // Before anyone is placed, the wizard's "Assign to" pick seeds it.
  const [crewKind, setCrewKind] = useState<CrewKind>(() => {
    const keys = crewKeysFromDayCoverage(dayCoverage)
    if (keys.some((key) => key.startsWith('team:'))) return 'team'
    if (keys.some((key) => key.startsWith('employee:'))) return 'employee'
    if (schedule.crew_ids?.length) return schedule.crew_kind ?? 'team'
    return teamOptions.length > 0 ? 'team' : 'employee'
  })

  const [poolIds, setPoolIds] = useState<string[]>(() => {
    const keys = crewKeysFromDayCoverage(dayCoverage)
    if (keys.length === 0) return schedule.crew_ids ?? []
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

  // Nothing is placed until the dates are settled: every table below is read
  // in real dates, and a suggestion made against the wrong start would put
  // crews on the wrong weekdays.
  const datesReady =
    dateStringSchema.safeParse(startDateValue).success &&
    endSettingsSchema.safeParse(endSettings).success

  const startDate = useMemo(() => {
    if (!startDateValue) return undefined
    const parsed = parse(startDateValue, 'yyyy-MM-dd', new Date())
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [startDateValue])

  const liveSchedule: RotateSchedule = {
    ...schedule,
    pattern,
    shift_ids: shiftIds,
    start_date: startDateValue ?? schedule.start_date,
    end_settings: endSettings ?? schedule.end_settings,
    day_coverage: dayCoverage,
    crew_placements: crewPlacements,
  }
  const advanceType = getAdvanceType(liveSchedule)
  const dayDates =
    datesReady && startDate ? cycleDayDates(liveSchedule, advanceType) : []
  const dayLabels = pattern.map((_, day) =>
    dayDates[day] ? format(dayDates[day], 'EEE d MMM') : `Day ${day + 1}`
  )

  // Not keyed on the pool itself, which wouldn't change the answer.
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
        // Only when exact — else the panel could tell someone who just
        // pressed Suggest that there are enough crews when there aren't.
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

  const poolOptions = crewKind === 'team' ? teamOptions : employeeOptions

  function applySuggestion() {
    const currentPattern =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    if (currentPattern.length === 0 || !datesReady) return

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

    const stored = crewPlacementsToStored(placements)
    // Both halves of the roster are written together so they can't drift
    // apart; the matrix is regenerated, never patched.
    setValue('crew_placements', stored, { shouldDirty: true })
    setValue(
      'day_coverage',
      cellsFromCrewPlacements(
        patternToSlots(currentPattern),
        stored,
        orderedShiftIds
      ),
      { shouldDirty: true }
    )
  }

  // Equal sets mean the roster on screen *is* this pool's assignment.
  const poolCrewKeys = poolIds.map((id) => `${crewKind}:${id}`)
  const placedCrewKeys = new Set(crews.map((crew) => crew.key))
  const coverageMatchesPool =
    poolCrewKeys.length === placedCrewKeys.size &&
    poolCrewKeys.every((key) => placedCrewKeys.has(key))

  // Makes "Save" accept what's showing: a no-op on the ordinary path, but
  // catches leaving with the suggestion half-taken (pool picked but never
  // applied, or changed after). Manual mode is left alone — re-running the
  // search over hand-placed crew would throw away exactly what the toggle
  // exists to allow.
  function commitPendingSuggestion() {
    if (
      manualMode ||
      !datesReady ||
      poolIds.length === 0 ||
      coverageMatchesPool
    )
      return
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
        This schedule has no pattern yet — build it from the schedule wizard
        first.
      </p>
    )
  }

  const rotation =
    datesReady && startDate
      ? buildRotation(
          liveSchedule,
          shifts,
          employees,
          teams,
          startDate,
          advanceType
        )
      : null

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

          {startEnd && (
            <div className='space-y-3 rounded-md border p-3'>
              <h3 className='text-sm font-semibold'>Start &amp; End</h3>
              {startEnd}
            </div>
          )}

          {!datesReady ? (
            <p
              className='flex items-center gap-1.5 text-sm text-muted-foreground'
              data-testid='dates-required'
            >
              <CalendarClock className='size-4 shrink-0' />
              Set the start date and end settings first — the assignment is laid
              out on real dates.
            </p>
          ) : (
            <>
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
                    Let the suggestion stagger the picked crews across the cycle
                    — it reuses the pattern&apos;s rhythm and moves each crew
                    along the shift list so every selected shift is covered
                    every day.
                  </p>
                  <CrewRequirementNote
                    requirement={requirement}
                    cycleLength={pattern.length}
                    shiftCount={orderedShiftIds.length}
                    selectedCount={poolIds.length}
                    crewKind={crewKind}
                  />
                  <Button
                    type='button'
                    onClick={applySuggestion}
                    disabled={disabled || poolIds.length === 0}
                  >
                    <Wand2 className='me-1 size-4' />
                    Suggest assignment
                  </Button>
                </div>
              ) : (
                <div className='space-y-3'>
                  <p className='text-sm text-muted-foreground'>
                    Staff each shift on each cycle day yourself — for the
                    rosters the suggestion cannot express. One card per cycle
                    day, one row per selected shift; an empty row is a shift
                    nobody is covering that day. The grid below keeps grading
                    whatever you set.
                  </p>
                  <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                    {pattern.map((entry, index) => (
                      <ManualDayCard
                        key={entry.position ?? index}
                        day={index}
                        label={dayLabels[index]}
                        orderedShiftIds={orderedShiftIds}
                        crewKind={crewKind}
                        crewOptions={poolOptions}
                        dayCoverage={dayCoverage}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </div>
              )}

              <RotationCoveragePanel
                analysis={analysis}
                orderedShiftIds={orderedShiftIds}
                cycleLength={pattern.length}
                shifts={shifts}
                dayLabels={dayLabels}
              >
                {rotation && rotation.rows.length > 0 && (
                  <div className='space-y-2'>
                    <h3 className='text-sm font-semibold'>Employees</h3>
                    <ScheduleRotationTable
                      rows={rotation.rows}
                      assignedHeading={`Assigned Shift · ${format(
                        startDate as Date,
                        'EEE, MMM d'
                      )}`}
                      cycleLength={rotation.cycleLength}
                    />
                  </div>
                )}
              </RotationCoveragePanel>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type CrewRequirementNoteProps = {
  requirement: CrewRequirement
  cycleLength: number
  shiftCount: number
  selectedCount: number
  crewKind: CrewKind
}

// How many crews the pattern needs for full coverage. Under the minimum is a
// fact about the pattern, not a mistake, so this never blocks or uses the
// destructive colour. The naive crew-days/cells division often undercounts
// by one, since two crews on duty together can land on the same shift and
// leave another empty — worth naming, since that's fixable by editing the
// pattern, not just by hiring.
function CrewRequirementNote({
  requirement,
  cycleLength,
  shiftCount,
  selectedCount,
  crewKind,
}: CrewRequirementNoteProps) {
  const { workDaysPerCrew, cellsPerCycle, crewDayBound, minimumCrews } =
    requirement
  if (minimumCrews === 0 || shiftCount === 0) return null

  const unit = crewKind === 'team' ? 'team' : 'employee'
  const short = minimumCrews - selectedCount
  // Only a demonstrated requirement licenses the green line — promising full
  // coverage and then showing a red 0 is what this guards against.
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
      {requirement.exact && minimumCrews > crewDayBound && (
        <p className='mt-1 text-muted-foreground'>
          That division comes to {plural(crewDayBound, unit)}, and it would be
          right if any crew could fill any gap — but every crew walks these same
          cards, only started on a different day, so two crews on duty together
          can land on the same shift and leave the other empty. Which shift each
          working card names is what decides the real number, so editing the
          pattern can lower it; this updates as you do.
        </p>
      )}
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
  // Cycle day this card reads and writes (`day_coverage.day`).
  day: number
  label: string
  orderedShiftIds: string[]
  crewKind: CrewKind
  crewOptions: Option[]
  dayCoverage: RotateDayCoverage[]
  disabled?: boolean
}

// One cycle day: every selected shift gets its own picker, so a hole is a
// visibly empty field. Cells are edited freely — a pick here moves nowhere
// else, which is the point of storing the matrix rather than crew offsets.
function ManualDayCard({
  day,
  label,
  orderedShiftIds,
  crewKind,
  crewOptions,
  dayCoverage,
  disabled,
}: ManualDayCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { getValues, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)

  // Written through `setValue` rather than a `FormField` per cell: the stored
  // array is sparse, so a cell has no stable index to register a controller
  // against — clearing one would renumber every field name after it.
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
          {label}
        </p>

        {orderedShiftIds.map((shiftId) => {
          const shift = shifts.find((s) => s.id === shiftId)
          const cell = dayCoverage.find(
            (entry) => entry.day === day && entry.shift_id === shiftId
          )
          const ids =
            (crewKind === 'team' ? cell?.team_ids : cell?.employee_ids) ?? []

          return (
            <div key={shiftId} className='space-y-0.5'>
              <span className='flex items-center gap-1 text-[10px] text-muted-foreground'>
                <ShiftSwatch shift={shift} />
                {shift?.name ?? 'Unknown shift'}
              </span>
              {/* Keyed on crew kind: without it, flipping Teams/Employees
                  while the grid is open leaves the picker holding the other
                  kind's ids and writes them to the wrong field. */}
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
                variant='compact'
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
