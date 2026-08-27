import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SEX_OPTIONS } from '../data/data'
import { type Employee } from '../data/schema'
import { EmployeeSelectField } from './employee-select-field'

// The employee create/edit form's fields — personal information only, on a
// single flat shadcn form. Reads/writes through `useFormContext`, matching
// how the shift form's tabs work.
export function EmployeeFields() {
  const form = useFormContext<Employee>()

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      <FormField
        control={form.control}
        name='firstname'
        render={({ field }) => (
          <FormItem>
            <FormLabel>First name</FormLabel>
            <FormControl>
              <Input placeholder='John' autoComplete='off' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='middlename'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Middle name</FormLabel>
            <FormControl>
              <Input placeholder='Michael' autoComplete='off' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='lastname'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Last name</FormLabel>
            <FormControl>
              <Input placeholder='Doe' autoComplete='off' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='dob'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date of birth</FormLabel>
            <FormControl>
              <Input type='date' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <EmployeeSelectField
        name='sex'
        label='Sex'
        placeholder='Select sex'
        options={SEX_OPTIONS}
      />
      <FormField
        control={form.control}
        name='email'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                type='email'
                placeholder='john.doe@example.com'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='phonenumber'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone number</FormLabel>
            <FormControl>
              <Input type='tel' placeholder='+1 555 0100' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name='address'
        render={({ field }) => (
          <FormItem className='sm:col-span-2'>
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Textarea placeholder='Street, city, country' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
