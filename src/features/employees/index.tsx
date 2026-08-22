import { useEffect, useState } from 'react'
import type z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, UserCog, XIcon } from 'lucide-react'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { PersonalInfo } from './components/personal-info'
import { Position } from './components/position'
import { Schedule } from './components/schedule'
import { SidebarNav } from './components/sidebar-nav'
import employeeData from './data/data.json'
import { EmployeeSchema } from './data/schema'

const route = getRouteApi('/_authenticated/employees')

const sidebarNavItems = [
  {
    title: 'Personal Info',
    value: 'personal-info',
    icon: <UserCog size={18} />,
  },
  {
    title: 'Schedule',
    value: 'schedule',
    icon: <XIcon size={18} />,
  },
  {
    title: 'Position',
    value: 'position',
    icon: <XIcon size={18} />,
  },
]

const EmployeesPage = () => {
  // States
  const [currentTab, setCurrentTab] = useState('personal-info')

  // Search — `?action=edit&employeeId=...` is what turns this into the edit
  // screen, so both derive from the URL rather than from local state.
  const { action, employeeId } = route.useSearch()
  const values =
    action === 'edit'
      ? employeeData.find((emp) => emp.id === employeeId)
      : undefined
  const isEdit = !!values

  /**
   *
   */
  const form = useForm<z.infer<typeof EmployeeSchema>>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      firstname: '',
      lastname: '',
      middlename: '',
      email: '',
      sex: {
        value: 'male',
        label: 'Male',
      },
      address: '',
      dob: '',
      organization_unit: {
        value: '',
        label: '',
      },
      position: {
        value: '',
        label: '',
      },
      punch_code: '',
      schedule: '',
      phonenumber: '',
    },
  })

  // The form is an uncontrolled external system — hydrating it from the
  // picked record is what an effect is for.
  useEffect(() => {
    if (values) {
      form.reset({
        firstname: values.firstname,
        lastname: values.lastname,
        middlename: values.middlename,
        email: values.email,
        sex: values.sex,
        address: values.address,
        dob: values.dob,
        organization_unit: values.organization_unit,
        position: values.position,
        punch_code: values.punch_code,
        schedule: values.schedule,
        phonenumber: values.phonenumber,
      })
    }
  }, [values, form])

  // Nothing persists yet — there's no employees store or API behind this
  // screen, so submitting only surfaces the payload.
  const onSubmit = (data: z.infer<typeof EmployeeSchema>) => {
    showSubmittedData(data, isEdit ? 'Employee updated:' : 'Employee created:')
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <Link to='/employees-list' className='flex items-center gap-1'>
            <ArrowLeft size={18} />
            <span className='text-sm'>Back to employees list</span>
          </Link>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {isEdit ? 'Edit Employee' : 'Add a new Employee'}
          </h1>

          {/* <p className='text-muted-foreground'>
            Manage your account settings and set e-mail preferences.
          </p> */}
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav
              items={sidebarNavItems}
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
            />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            {currentTab === 'personal-info' && <PersonalInfo form={form} />}
            {currentTab === 'position' && <Position form={form} />}
            {currentTab === 'schedule' && <Schedule form={form} />}
            <Button
              type='button'
              form='employee-form'
              onClick={form.handleSubmit(onSubmit)}
              className='w-fit place-self-end'
            >
              Save changes
            </Button>
          </div>
        </div>
      </Main>
    </>
  )
}

export default EmployeesPage
