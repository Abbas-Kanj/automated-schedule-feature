import { useFormContext, useWatch } from 'react-hook-form'
import { TriangleAlert } from 'lucide-react'
import { plural } from '@/lib/plural'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FilterableMultiSelect } from '@/components/multi-select/filterable-multi-select'
import { ToggleButton } from '@/components/toggle-button'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import {
  type CrewKind,
  type ShiftAssignment,
  type ShiftOccurrence,
} from '../../data/schema'
import {
  crewsOnMultipleShifts,
  shiftCrewIds,
  withShiftCrewIds,
} from '../../fixed-schedule'
import { occurrenceLabels } from '../../occurrence-pattern'
import { orderShiftIdsByStart } from '../../rotation-crews'

type Option = { value: string; label: string }

type FixedAssignToFieldsProps = {
  disabled?: boolean
}

// Fixed only: who works each selected shift. Which days a shift runs is its
// occurrence's business, so this is one picker per shift, not per day. A crew
// may be on several shifts — that's warned about, not blocked.
export function FixedAssignToFields({ disabled }: FixedAssignToFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue, clearErrors } = useFormContext<any>()
  const crewKind = (useWatch({ control, name: 'crew_kind' }) ??
    'team') as CrewKind
  const shiftIds =
    (useWatch({ control, name: 'shift_ids' }) as string[] | undefined) ?? []
  const assignments = useWatch({ control, name: 'shift_assignments' }) as
    | ShiftAssignment[]
    | undefined
  const occurrences = useWatch({ control, name: 'shift_occurrences' }) as
    | ShiftOccurrence[]
    | undefined

  const shifts = useShiftsStore((s) => s.shifts)
  const teams = useTeamsStore((s) => s.teams)
  const employees = useEmployeesStore((s) => s.employees)

  const teamOptions: Option[] = teams.map((team) => ({
    value: team.id,
    label: team.name,
  }))
  const employeeOptions: Option[] = employees
    .filter((employee) => employee.id)
    .map((employee) => ({
      value: employee.id as string,
      label: getEmployeeFullName(employee),
    }))
  const options = crewKind === 'team' ? teamOptions : employeeOptions
  const labelOf = new Map(options.map((option) => [option.value, option.label]))
  const unit = crewKind === 'team' ? 'team' : 'employee'

  const shared = crewsOnMultipleShifts(assignments, crewKind)

  // Team ids and employee ids are different namespaces, so switching kind
  // starts every shift's pick over.
  const selectKind = (kind: CrewKind) => {
    if (kind === crewKind) return
    setValue('crew_kind', kind, { shouldDirty: true })
    setValue('shift_assignments', [], { shouldDirty: true })
    clearErrors('shift_assignments')
  }

  const setShiftCrews = (shiftId: string, ids: string[]) => {
    setValue(
      'shift_assignments',
      withShiftCrewIds(assignments, shiftId, crewKind, ids),
      { shouldDirty: true }
    )
    clearErrors('shift_assignments')
  }

  if (shiftIds.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Pick shifts first to assign teams or employees to them.
      </p>
    )
  }

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-base font-semibold'>
          Who works each shift
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <ToggleButton
            size='sm'
            selected={crewKind === 'team'}
            disabled={disabled || teamOptions.length === 0}
            onClick={() => selectKind('team')}
          >
            Teams
          </ToggleButton>
          <ToggleButton
            size='sm'
            selected={crewKind === 'employee'}
            disabled={disabled}
            onClick={() => selectKind('employee')}
          >
            Employees
          </ToggleButton>
          <span className='text-xs text-muted-foreground'>
            {crewKind === 'team'
              ? 'A team works together as one crew.'
              : 'Each employee is their own crew.'}
          </span>
        </div>

        {shared.size > 0 && (
          <p
            className='flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400'
            data-testid='multi-shift-warning'
          >
            <TriangleAlert className='size-4 shrink-0' />
            {plural(shared.size, unit)} {shared.size === 1 ? 'is' : 'are'}{' '}
            assigned to more than one shift.
          </p>
        )}

        <div className='space-y-3'>
          {orderShiftIdsByStart(shiftIds, shifts).map((shiftId) => {
            const shift = shifts.find((s) => s.id === shiftId)
            const ids = shiftCrewIds(assignments, shiftId, crewKind)
            const days = occurrenceLabels(
              occurrences?.find((rule) => rule.shift_id === shiftId)
            )
            const sharedHere = ids.filter((id) => shared.has(id))

            return (
              <div
                key={shiftId}
                className='space-y-2 rounded-md border p-3'
                data-testid={`assign-shift-${shiftId}`}
              >
                <div className='flex flex-wrap items-center gap-2'>
                  <ShiftSwatch shift={shift} size='md' />
                  <span className='text-sm font-medium'>
                    {shift?.name ?? 'Unknown shift'}
                  </span>
                  {days.length > 0 && (
                    <span className='text-xs text-muted-foreground'>
                      {days.join(', ')}
                    </span>
                  )}
                  {sharedHere.length > 0 && (
                    <span
                      className='ms-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400'
                      title={`Also on another shift: ${sharedHere
                        .map((id) => labelOf.get(id) ?? id)
                        .join(', ')}`}
                    >
                      <TriangleAlert className='size-3.5 shrink-0' />
                      {plural(sharedHere.length, unit)} on other shifts too
                    </span>
                  )}
                </div>
                {/* Keyed on the kind so the picker remounts rather than
                      holding the other kind's ids for a frame. */}
                <FilterableMultiSelect
                  key={crewKind}
                  options={options}
                  value={options.filter((option) => ids.includes(option.value))}
                  onChange={(selected: Option[]) =>
                    setShiftCrews(
                      shiftId,
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
                  isDisabled={disabled || options.length === 0}
                />
                {ids.length === 0 && (
                  <p className='text-xs text-amber-600 dark:text-amber-400'>
                    Nobody is on this shift yet.
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <ShiftAssignmentsError />
      </CardContent>
    </Card>
  )
}

function ShiftAssignmentsError() {
  const {
    formState: { errors },
  } = useFormContext()
  const message = errors.shift_assignments?.message
  if (typeof message !== 'string') return null
  return <p className='text-sm font-medium text-destructive'>{message}</p>
}
