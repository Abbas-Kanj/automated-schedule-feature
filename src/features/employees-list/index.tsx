import { router } from '@/main'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useEmployeesStore } from '@/features/employees/stores/employees-store'
import { EmployeesTable } from './components/employees-table'

const EmployeesListPage = () => {
  const employees = useEmployeesStore((s) => s.employees)

  return (
    <>
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
              Employee Management
            </h2>
            <p className='text-muted-foreground'>
              Manage your employees and their roles here.
            </p>
          </div>
          <Button
            className='space-x-1'
            onClick={() => router.navigate({ to: '/employees' })}
          >
            <span>Add new employee</span> <Plus size={18} />
          </Button>
        </div>
        <EmployeesTable data={employees} />
      </Main>
    </>
  )
}

export default EmployeesListPage
