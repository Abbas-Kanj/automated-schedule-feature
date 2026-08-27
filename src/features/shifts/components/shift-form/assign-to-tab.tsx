import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { MultiSelect } from '@/components/multi-select'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { useTeamsStore } from '@/features/teams/stores/teams-store'
import { WORK_TYPE_GROUP_OPTIONS } from '../../data/data'
import { type ShiftFormValues } from '../../data/schema'

type Option = { value: string; label: string }

// "Assign to" tab of `ShiftFormDialog` (formerly "Additional info") — its
// own toggle enables/disables the picks below. The Employees/Teams picks now
// actually drive the Schedule Rotation screen (see
// `features/schedule-rotation`, which reads them to derive who rotates
// through a schedule's shifts); the "Work type group" dropdown stays a
// freeform pick with no downstream behaviour, kept for parity with the
// original wireframe.
export function AssignToTab() {
  const form = useFormContext<ShiftFormValues>()
  const assignToEnabled = useWatch({
    control: form.control,
    name: 'assign_to_enabled',
  })

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

  return (
    <div className='space-y-4 px-0.5'>
      <FormField
        control={form.control}
        name='assign_to_enabled'
        render={({ field }) => (
          <FormItem className='flex w-fit flex-row items-center gap-4 rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Assign to</FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='work_type_group'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Work type group</FormLabel>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!assignToEnabled}
            >
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a work type group' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {WORK_TYPE_GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='employee_ids'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Employees</FormLabel>
            <MultiSelect
              options={employeeOptions}
              value={employeeOptions.filter((option) =>
                field.value?.includes(option.value)
              )}
              onChange={(selected: Option[]) =>
                field.onChange((selected ?? []).map((option) => option.value))
              }
              isMulti
              placeholder='Select employees'
              isDisabled={!assignToEnabled}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='team_ids'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Teams</FormLabel>
            <MultiSelect
              options={teamOptions}
              value={teamOptions.filter((option) =>
                field.value?.includes(option.value)
              )}
              onChange={(selected: Option[]) =>
                field.onChange((selected ?? []).map((option) => option.value))
              }
              isMulti
              placeholder='Select teams'
              isDisabled={!assignToEnabled}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
