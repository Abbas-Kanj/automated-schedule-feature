import { type Control } from 'react-hook-form'
import { MultiSelect } from '@/components/multi-select'
import { FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { employees } from '../../data/employees'

type EmployeeMultiSelectProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  disabled?: boolean
}

const SELECT_ALL_OPTION = { value: '__select_all__', label: 'Select all employees' }

export function EmployeeMultiSelect({
  control,
  disabled,
}: EmployeeMultiSelectProps) {
  return (
    <FormField
      control={control}
      name='employees'
      render={({ field }) => (
        <FormItem>
          <FormLabel>Employees</FormLabel>
          <MultiSelect
            options={[SELECT_ALL_OPTION, ...employees]}
            value={field.value ?? []}
            onChange={(selected: typeof employees) => {
              const pickedSelectAll = selected.some(
                (o) => o.value === SELECT_ALL_OPTION.value
              )
              field.onChange(pickedSelectAll ? employees : selected)
            }}
            isMulti
            placeholder='Select employees'
            isDisabled={disabled}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
