import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { MultiSelect } from '@/components/multi-select'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import {
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { type RotatePatternEntry } from '../../data/schema'

type Option = { value: string; label: string }

type ScheduleAssignToFieldsProps = {
  disabled?: boolean
}

// "Assign to" step of a rotate schedule (after "Pattern" — see
// `schedule-form.tsx`'s step list). One row per cycle position, each naming
// the crew that starts the cycle there.
//
// This is what the Schedule Rotation screen reads to build its roster (see
// `features/schedule-rotation/utils.ts#getRotationRoster`): a position's
// pick is that crew's starting slot, and they advance one position per
// period from there. An off position is assignable like any other — being
// off is a slot people rotate through, and it has no shift of its own to
// carry the pick.
//
// Shifts keep their own "Assign to" tab (see
// `features/shifts/components/shift-form/assign-to-tab.tsx`) — that says who
// may work a shift in general, which is a different question from who holds
// which slot of this particular rotation.
export function ScheduleAssignToFields({
  disabled,
}: ScheduleAssignToFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const pattern =
    (useWatch({ control, name: 'pattern' }) as
      | RotatePatternEntry[]
      | undefined) ?? []

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

  if (pattern.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Build the pattern in the previous step to assign crew to it.
      </p>
    )
  }

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-base font-semibold'>Assign to</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4'>
        <p className='text-sm text-muted-foreground'>
          Pick who starts the cycle on each position. Everyone assigned here
          advances one position per period, so a rotation covers every position
          when it has as many crew as it has positions.
        </p>

        {pattern.map((entry, index) => {
          const shift = entry.is_off
            ? undefined
            : shifts.find((s) => s.id === entry.shift_id)
          const Icon = shift ? SHIFT_ICON_COMPONENTS[shift.icon] : undefined
          const color = shift
            ? SHIFT_BADGE_COLOR_OPTIONS.find(
                (o) => o.value === shift.badge_color
              )
            : undefined

          return (
            <div
              key={entry.position ?? index}
              className='space-y-3 border-t pt-4 first:border-t-0 first:pt-0'
            >
              <div className='flex items-center gap-2'>
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    color?.swatchClassName ?? 'bg-muted-foreground/40'
                  )}
                />
                {Icon && (
                  <Icon className='size-4 shrink-0 text-muted-foreground' />
                )}
                <p className='text-sm font-medium'>{shift?.name ?? 'Off'}</p>
                <span className='ms-auto shrink-0 text-xs text-muted-foreground'>
                  Position {index + 1}
                </span>
              </div>

              <div className='grid gap-3 sm:grid-cols-2'>
                <FormField
                  control={control}
                  name={`pattern.${index}.employee_ids`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employees</FormLabel>
                      <MultiSelect
                        options={employeeOptions}
                        value={employeeOptions.filter((option) =>
                          field.value?.includes(option.value)
                        )}
                        onChange={(selected: Option[]) =>
                          field.onChange(
                            (selected ?? []).map((option) => option.value)
                          )
                        }
                        isMulti
                        placeholder='Select employees'
                        isDisabled={disabled}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`pattern.${index}.team_ids`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teams</FormLabel>
                      <MultiSelect
                        options={teamOptions}
                        value={teamOptions.filter((option) =>
                          field.value?.includes(option.value)
                        )}
                        onChange={(selected: Option[]) =>
                          field.onChange(
                            (selected ?? []).map((option) => option.value)
                          )
                        }
                        isMulti
                        placeholder={
                          teamOptions.length
                            ? 'Select teams'
                            : 'No teams yet — create one first'
                        }
                        isDisabled={disabled || teamOptions.length === 0}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
