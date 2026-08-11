import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SchedulesDialogs } from './components/schedules-dialogs'
import { SchedulesProvider } from './components/schedules-provider'
import { SchedulesTable } from './components/schedules-table'
import { useSchedulesStore } from './stores/schedules-store'

export function Schedules() {
  const schedules = useSchedulesStore((s) => s.schedules)

  return (
    <SchedulesProvider>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Schedules</h2>
          </div>
          <Button className='space-x-1' asChild>
            <Link to='/schedules/new'>
              <span>Create</span> <Plus size={18} />
            </Link>
          </Button>
        </div>
        <SchedulesTable data={schedules} />
      </Main>

      <SchedulesDialogs />
    </SchedulesProvider>
  )
}
