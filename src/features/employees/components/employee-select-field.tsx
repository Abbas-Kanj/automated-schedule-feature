import { useFormContext } from 'react-hook-form'
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
import { type Employee } from '../data/schema'

type Option = { value: string; label: string }

// These fields store `{ value, label }` objects, but shadcn Select works in
// plain strings — this maps the emitted string back to the stored object.
type EmployeeObjectField = 'sex' | 'position' | 'organization_unit'

type EmployeeSelectFieldProps = {
  name: EmployeeObjectField
  label: string
  placeholder: string
  options: Option[]
}

export function EmployeeSelectField({
  name,
  label,
  placeholder,
  options,
}: EmployeeSelectFieldProps) {
  const form = useFormContext<Employee>()

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value?.value ?? ''}
            onValueChange={(value) =>
              field.onChange(
                options.find((option) => option.value === value) ?? {
                  value: '',
                  label: '',
                }
              )
            }
          >
            <FormControl>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
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
  )
}
