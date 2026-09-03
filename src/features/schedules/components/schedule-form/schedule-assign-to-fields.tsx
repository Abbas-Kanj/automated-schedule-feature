import { type RefObject, useEffect, useMemo, useState } from 'react'
import { parse } from 'date-fns'
import { useFormContext, useWatch } from 'react-hook-form'
import { Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MultiSelect } from '@/components/multi-select'
import { SelectDropdown } from '@/components/select-dropdown'
import { ToggleButton } from '@/components/toggle-button'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { type RotatePatternEntry } from '../../data/schema'
import { assignmentsFromPattern, patternToSlots } from '../../rotation-crews'
import {
  type SuggestionCrew,
  analyzeRotation,
  suggestRotationAssignment,
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
// `schedule-form.tsx`'s step list). Answers one question: who starts the cycle
// on which position?
//
// A crew's starting position is its offset into the pattern — everything
// downstream is `(stepsSinceStart + offset) mod cycleLength` (see
// `features/schedule-rotation/utils.ts#getAssignedIndex`). Picking those
// offsets well is the whole job, and doing it by hand across a 14- or 28-day
// roster is guesswork, so "Suggest assignment" searches for the offsets that
// flatten coverage and the panel below grades whatever is currently set.
//
// Hand-assignment stays available behind a toggle for the rosters the search
// cannot express — it is the escape hatch, not the default path.
//
// Shifts keep their own "Assign to" tab (see
// `features/shifts/components/shift-form/assign-to-tab.tsx`) — that says who
// may work a shift in general, which is a different question from who holds
// which slot of this particular rotation.
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
  const shiftIdsRaw = useWatch({ control, name: 'shift_ids' }) as
    | string[]
    | undefined
  // Memoised for the same reason as `pattern` above — the day cards' shift
  // options key off it.
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

  // The crew pool is deliberately not a form field. The union of what is
  // already assigned *is* the pool, so it round-trips through a saved schedule
  // without adding anything to the schema. This component unmounts when the
  // wizard leaves the step, so returning to it re-derives from the pattern.
  const [crewKind, setCrewKind] = useState<CrewKind>(() => {
    const hasTeams = pattern.some((entry) => entry.team_ids?.length)
    if (hasTeams) return 'team'
    const hasEmployees = pattern.some((entry) => entry.employee_ids?.length)
    if (hasEmployees) return 'employee'
    return teamOptions.length > 0 ? 'team' : 'employee'
  })

  const [poolIds, setPoolIds] = useState<string[]>(() => {
    const teamIds = [...new Set(pattern.flatMap((e) => e.team_ids ?? []))]
    if (teamIds.length) return teamIds
    return [...new Set(pattern.flatMap((e) => e.employee_ids ?? []))]
  })

  const [manualMode, setManualMode] = useState(false)

  const slots = useMemo(() => patternToSlots(pattern), [pattern])

  const assignments = useMemo(
    () => assignmentsFromPattern(pattern, teams, employeeLabels),
    [pattern, teams, employeeLabels]
  )

  const startDate = useMemo(() => {
    if (!startDateValue) return undefined
    const parsed = parse(startDateValue, 'yyyy-MM-dd', new Date())
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }, [startDateValue])

  const analysis = useMemo(
    () => analyzeRotation(slots, assignments, { startDate }),
    [slots, assignments, startDate]
  )

  const poolOptions = crewKind === 'team' ? teamOptions : employeeOptions

  // The shifts this schedule selected, in the shape the day cards' read-only
  // shift field needs — mirrors `pattern-builder.tsx`'s own `shiftOptions`.
  const shiftOptions = useMemo(
    () =>
      shiftIds.flatMap((id) => {
        const shift = shifts.find((s) => s.id === id)
        return shift ? [{ value: shift.id, label: shift.name }] : []
      }),
    [shiftIds, shifts]
  )

  function applySuggestion() {
    const current =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []

    const crews = poolIds.flatMap<SuggestionCrew>((id) => {
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

    if (crews.length === 0 || current.length === 0) return

    const { assignments: suggested } = suggestRotationAssignment(slots, crews, {
      startDate,
    })

    const employeesByOffset = new Map<number, string[]>()
    const teamsByOffset = new Map<number, string[]>()
    suggested.forEach(({ crew, offset }) => {
      const id = crew.key.split(':')[1]
      const target = crew.kind === 'team' ? teamsByOffset : employeesByOffset
      target.set(offset, [...(target.get(offset) ?? []), id])
    })

    // Every position is written, not just the ones that received someone —
    // otherwise a crew left over from a previous suggestion stays behind and
    // silently double-books a position.
    current.forEach((_, index) => {
      setValue(
        `pattern.${index}.employee_ids`,
        employeesByOffset.get(index) ?? [],
        { shouldDirty: true }
      )
      setValue(`pattern.${index}.team_ids`, teamsByOffset.get(index) ?? [], {
        shouldDirty: true,
      })
    })
  }

  // Does the pattern already hold exactly the pool the user picked? Equal sets
  // mean the roster on screen *is* this pool's assignment — because "Suggest
  // assignment" was pressed, or because it arrived that way from a saved
  // schedule.
  const poolCrewKeys = poolIds.map((id) => `${crewKind}:${id}`)
  const placedCrewKeys = new Set(assignments.map(({ crew }) => crew.key))
  const patternMatchesPool =
    poolCrewKeys.length === placedCrewKeys.size &&
    poolCrewKeys.every((key) => placedCrewKeys.has(key))

  // "Next" accepts what this step is showing.
  //
  // Pressing "Suggest assignment" writes its offsets straight into `pattern[]`
  // already, so on the ordinary path this is a no-op. It exists for the two
  // ways of leaving the step with the suggestion only half-taken: picking a
  // pool and continuing without ever pressing the button, and changing the
  // pool after pressing it. Both used to advance with a roster that did not
  // match what the user had selected, and nothing on the following steps says
  // so — the Summary just lists whoever was on the pattern.
  //
  // Manual mode is left strictly alone: it is the escape hatch for rosters the
  // search cannot express, so re-running the search over hand-placed crew
  // would throw away the exact work the toggle exists to allow.
  function commitPendingSuggestion() {
    if (manualMode || poolIds.length === 0 || patternMatchesPool) return
    applySuggestion()
  }

  // No dependency list on purpose — the callback closes over the pool and the
  // pattern, so the form has to be handed a fresh one after every render.
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
          <p className='text-sm text-muted-foreground'>
            Pick the crews, then let the suggestion stagger them across the
            cycle so they are not all resting on the same day.
          </p>

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

          <RotationCoveragePanel
            slots={slots}
            assignments={assignments}
            analysis={analysis}
            shifts={shifts}
          />
        </CardContent>
      </Card>

      <Card className='gap-3 py-4'>
        <CardHeader className='flex flex-row items-center justify-between gap-3 px-4'>
          <CardTitle className='text-base font-semibold'>
            Assign manually
          </CardTitle>
          <div className='flex shrink-0 items-center gap-2'>
            <Label
              htmlFor='manual-assign'
              className='text-xs font-normal text-muted-foreground'
            >
              {manualMode ? 'On' : 'Off'}
            </Label>
            <Switch
              id='manual-assign'
              checked={manualMode}
              onCheckedChange={setManualMode}
              disabled={disabled}
            />
          </div>
        </CardHeader>
        <CardContent className='space-y-3 px-4'>
          {!manualMode ? (
            <p className='text-sm text-muted-foreground'>
              Turn this on to place crews on specific cycle days yourself — for
              the rosters the suggestion cannot express. The coverage grid above
              keeps grading whatever you set.
            </p>
          ) : (
            <>
              <p className='text-sm text-muted-foreground'>
                One card per cycle day. The shift is fixed by the pattern; pick
                who starts on that day.
              </p>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
                {pattern.map((entry, index) => (
                  <ManualAssignCard
                    key={entry.position ?? index}
                    index={index}
                    entry={entry}
                    crewKind={crewKind}
                    crewOptions={
                      crewKind === 'team' ? teamOptions : employeeOptions
                    }
                    shiftOptions={shiftOptions}
                    disabled={disabled}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type ManualAssignCardProps = {
  index: number
  entry: RotatePatternEntry
  crewKind: CrewKind
  crewOptions: Option[]
  shiftOptions: Option[]
  disabled?: boolean
}

// One cycle day, laid out like the Pattern step's own day cards so the two
// screens read as the same grid. The difference is which control is live: the
// shift is shown as a disabled field (the pattern owns it — change it back on
// the previous step), and the editable dropdown is the crew.
//
// Only the crew kind picked above is offered, never both at once.
function ManualAssignCard({
  index,
  entry,
  crewKind,
  crewOptions,
  shiftOptions,
  disabled,
}: ManualAssignCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)

  const assignedShift =
    !entry.is_off && entry.shift_id
      ? shifts.find((s) => s.id === entry.shift_id)
      : undefined
  const Icon = assignedShift
    ? SHIFT_ICON_COMPONENTS[assignedShift.icon]
    : undefined
  const color = assignedShift
    ? SHIFT_BADGE_COLOR_OPTIONS.find(
        (o) => o.value === assignedShift.badge_color
      )
    : undefined

  const shiftValue = assignedShift ? assignedShift.id : 'off'
  const shiftItems = [{ value: 'off', label: 'Off' }, ...shiftOptions]

  const crewField = crewKind === 'team' ? 'team_ids' : 'employee_ids'
  const hasCrew = (entry[crewField] ?? []).length > 0

  return (
    <Card className='gap-1 py-2' data-testid={`assign-day-${index}`}>
      <CardContent className='space-y-1.5 px-2'>
        <div className='flex min-h-4 items-center justify-center gap-1'>
          {assignedShift && (
            <>
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  color?.swatchClassName
                )}
              />
              {Icon && <Icon className='size-3 shrink-0' />}
            </>
          )}
          <p className='truncate text-center text-xs text-muted-foreground'>
            Day {index + 1}
          </p>
        </div>

        {/* Read-only: the pattern decides the shift, this step decides who. */}
        <SelectDropdown
          isControlled
          defaultValue={shiftValue}
          items={shiftItems}
          disabled
          className='h-8 text-xs'
        />

        {/* Keyed on the field name: without it, flipping Teams/Employees while
            the grid is open re-registers the controller under the *new* name
            while it still holds the old one's value, copying employee ids into
            `team_ids` (and back). Remounting reads the new field instead. */}
        <FormField
          key={crewField}
          control={control}
          name={`pattern.${index}.${crewField}`}
          render={({ field }) => (
            <FormItem>
              <MultiSelect
                options={crewOptions}
                value={crewOptions.filter((option) =>
                  field.value?.includes(option.value)
                )}
                onChange={(selected: Option[]) =>
                  field.onChange((selected ?? []).map((option) => option.value))
                }
                isMulti
                compactHeight
                placeholder={crewKind === 'team' ? 'Team' : 'Employee'}
                isDisabled={disabled || crewOptions.length === 0}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Pinning only means something once a crew is here and there is more
            than one shift for them to be pinned to. */}
        {hasCrew && shiftOptions.length > 1 && (
          <FormField
            control={control}
            name={`pattern.${index}.crew_shift_id`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className='text-[10px] font-normal text-muted-foreground'>
                  Works
                </FormLabel>
                <SelectDropdown
                  isControlled
                  defaultValue={field.value ?? 'rotate'}
                  onValueChange={(value) =>
                    field.onChange(value === 'rotate' ? undefined : value)
                  }
                  items={[
                    { value: 'rotate', label: 'Rotates' },
                    ...shiftOptions.map((option) => ({
                      value: option.value,
                      label: `Always ${option.label}`,
                    })),
                  ]}
                  disabled={disabled}
                  className='h-8 text-xs'
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </CardContent>
    </Card>
  )
}
