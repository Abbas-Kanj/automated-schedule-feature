import { type UseFormReturn } from 'react-hook-form'
import Select from 'react-select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type Employee } from '../data/schema'

type Props = {
  form: UseFormReturn<Employee>
}

export const PersonalInfo = ({ form }: Props) => {
  return (
    <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
      <Form {...form}>
        <form
          id='employee-form'
          // onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-4 px-0.5'
        >
          <FormField
            control={form.control}
            name='firstname'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  First Name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder='John'
                    className='col-span-4'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='middlename'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  Middle name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder='John'
                    className='col-span-4'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='lastname'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>Last Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder=''
                    className='col-span-4'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='dob'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>DOB</FormLabel>
                <FormControl>
                  <Input
                    placeholder='john_doe'
                    className='col-span-4'
                    type='date'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder='john.doe@gmail.com'
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='phonenumber'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  Phone Number
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder='+123456789'
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='sex'
            render={({ field }) => {
              return (
                <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                  <FormLabel className='col-span-2 text-end'>Sex</FormLabel>
                  <Select
                    className='w-40'
                    options={[
                      {
                        value: 'male',
                        label: 'Male',
                      },
                      {
                        value: 'female',
                        label: 'Female',
                      },
                    ]}
                    {...field}
                  />

                  <FormMessage className='col-span-4 col-start-3' />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name='address'
            render={({ field }) => (
              <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>Address</FormLabel>
                <FormControl>
                  <Input
                    // placeholder='+123456789'
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}
