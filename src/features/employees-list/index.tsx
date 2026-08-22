import { getRouteApi } from '@tanstack/react-router'
import { router } from '@/main'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import employeeList from '../employees/data/data.json'
import { EmployeesListProvider } from './components/employees-list-provider'
import { EmployeesListTable } from './components/employees-list-table'

const route = getRouteApi('/_authenticated/employees-list')

const EmployeesListPage = () => {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <div>
      <EmployeesListProvider>
        <Header fixed>
          <Search className='me-auto' />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </Header>

        <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
          <div className='flex flex-wrap items-end justify-between gap-2'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>
                Employees List
              </h2>
              <p className='text-muted-foreground'>
                Manage your EmployeesList and their roles here.
              </p>
            </div>
            <Button onClick={() => router.navigate({ to: '/employees' })}>
              Add new employee
            </Button>
          </div>
          <EmployeesListTable
            data={employeeList}
            navigate={navigate}
            search={search}
          />
        </Main>

        {/* <EmployeesListDialogs /> */}
      </EmployeesListProvider>
    </div>
  )
}

export default EmployeesListPage
