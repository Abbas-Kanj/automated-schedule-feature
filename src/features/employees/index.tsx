import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { EmployeeFields } from './components/employee-fields'
import employeeData from './data/data.json'
import { type Employee, EmployeeSchema } from './data/schema'

const route = getRouteApi('/_authenticated/employees')

const DEFAULT_EMPLOYEE: Employee = {
  firstname: '',
  middlename: '',
  lastname: '',
  dob: '',
  sex: { value: 'male', label: 'Male' },
  address: '',
  email: '',
  phonenumber: '',
  position: { value: '', label: '' },
  organization_unit: { value: '', label: '' },
}

const EmployeesPage = () => {
  // `?action=edit&employeeId=...` is what turns this into the edit screen, so
  // the edited record derives from the URL rather than local state.
  const { action, employeeId } = route.useSearch()
  const editing = (
    action === 'edit'
      ? employeeData.find((employee) => employee.id === employeeId)
      : undefined
  ) as Employee | undefined
  const isEdit = !!editing

  const form = useForm<Employee>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: editing ?? DEFAULT_EMPLOYEE,
  })

  // The form is an uncontrolled external system — hydrating it from the
  // picked record is what an effect is for.
  useEffect(() => {
    if (editing) form.reset(editing)
  }, [editing, form])

  // Nothing persists yet — there's no employees API behind this screen, so
  // submitting only surfaces the payload.
  const onSubmit = (data: Employee) => {
    showSubmittedData(data, isEdit ? 'Employee updated:' : 'Employee created:')
  }

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main>
        <Button variant='ghost' size='sm' asChild className='-ms-2 mb-2 w-fit'>
          <Link to='/employees-list'>
            <ArrowLeft size={16} />
            Back to employees
          </Link>
        </Button>

        <div className='mb-4 flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {isEdit ? 'Edit employee' : 'Add a new employee'}
            </h2>
            <p className='text-muted-foreground'>
              {isEdit
                ? "Update this employee's details."
                : "Fill in the employee's details to add them."}
            </p>
          </div>
        </div>

        <Separator className='mb-6' />

        <Form {...form}>
          <form
            id='employee-form'
            onSubmit={form.handleSubmit(onSubmit, () =>
              toast.error('Please complete the required fields.')
            )}
            className='max-w-3xl'
          >
            <EmployeeFields />

            <div className='mt-8 flex justify-end gap-2'>
              <Button type='button' variant='outline' asChild>
                <Link to='/employees-list'>Cancel</Link>
              </Button>
              <Button type='submit'>
                {isEdit ? 'Save changes' : 'Add employee'}
              </Button>
            </div>
          </form>
        </Form>
      </Main>
    </>
  )
}

export default EmployeesPage
