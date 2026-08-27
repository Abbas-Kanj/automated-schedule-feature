import { useMemo } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MultiSelect } from '@/components/multi-select'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { getEmployeeFullName } from '@/features/employees/utils'
import { emptyTeamFormValues } from '../data/defaults'
import { type Team, type TeamFormValues, teamFormSchema } from '../data/schema'
import { useTeamsStore } from '../stores/teams-store'

type TeamFormDialogProps = {
  currentRow?: Team
  open: boolean
  onOpenChange: (open: boolean) => void
}

type EmployeeOption = { value: string; label: string }

// Creates or edits a team — a name, an optional description, and a
// multi-select of members drawn from the employee directory store.
export function TeamFormDialog({
  currentRow,
  open,
  onOpenChange,
}: TeamFormDialogProps) {
  const isEdit = !!currentRow
  const addTeam = useTeamsStore((s) => s.addTeam)
  const updateTeam = useTeamsStore((s) => s.updateTeam)
  const employees = useEmployeesStore((s) => s.employees)

  const employeeOptions = useMemo<EmployeeOption[]>(
    () =>
      employees
        .filter((employee) => employee.id)
        .map((employee) => ({
          value: employee.id as string,
          label: getEmployeeFullName(employee),
        })),
    [employees]
  )

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema) as Resolver<TeamFormValues>,
    defaultValues: isEdit ? currentRow : emptyTeamFormValues,
  })

  const onSubmit = (values: TeamFormValues) => {
    const saved: Team = {
      ...values,
      id: currentRow?.id ?? generateId(),
    }

    if (isEdit) {
      updateTeam(saved.id, saved)
      toast.success(`Team "${saved.name}" has been updated.`)
    } else {
      addTeam(saved)
      toast.success(`Team "${saved.name}" has been created.`)
    }
    onOpenChange(false)
    form.reset(isEdit ? saved : emptyTeamFormValues)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) form.reset(isEdit ? currentRow : emptyTeamFormValues)
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? 'Edit team' : 'Add new team'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this team and the employees it groups.'
              : 'Name the team, then pick the employees it groups.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id='team-form'
            onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
            className='max-h-[60vh] space-y-4 overflow-y-auto px-0.5'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Team name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Optional notes about this team'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
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
                    onChange={(selected: EmployeeOption[]) =>
                      field.onChange(
                        (selected ?? []).map((option) => option.value)
                      )
                    }
                    isMulti
                    placeholder='Select employees'
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type='submit' form='team-form'>
            {isEdit ? 'Save changes' : 'Add team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
