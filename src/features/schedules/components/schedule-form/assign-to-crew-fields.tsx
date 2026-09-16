import { useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { FilterableMultiSelect } from '@/components/multi-select/filterable-multi-select'
import { ToggleButton } from '@/components/toggle-button'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { type CrewKind } from '../../data/schema'

type Option = { value: string; label: string }

type AssignToCrewFieldsProps = {
  disabled?: boolean
}

// Rotate only: who this rotation's roster is drawn from. The rotating Work
// schedule's "Assign crews" places exactly these crews on days and shifts.
export function AssignToCrewFields({ disabled }: AssignToCrewFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue, clearErrors } = useFormContext<any>()
  const crewKind = (useWatch({ control, name: 'crew_kind' }) ??
    'team') as CrewKind

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

  // Team ids and employee ids are different namespaces, so switching kind
  // starts the pick over.
  const selectKind = (kind: CrewKind) => {
    if (kind === crewKind) return
    setValue('crew_kind', kind, { shouldDirty: true })
    setValue('crew_ids', [], { shouldDirty: true })
    clearErrors('crew_ids')
  }

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-base font-semibold'>
          Who is on this schedule
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

        {/* Keyed on the kind so the picker remounts rather than holding the
            other kind's ids for a frame. */}
        <FormField
          key={crewKind}
          control={control}
          name='crew_ids'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {crewKind === 'team' ? 'Teams' : 'Employees'}
              </FormLabel>
              <FilterableMultiSelect
                options={options}
                value={options.filter((option) =>
                  ((field.value as string[] | undefined) ?? []).includes(
                    option.value
                  )
                )}
                onChange={(selected: Option[]) =>
                  field.onChange((selected ?? []).map((option) => option.value))
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
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}
