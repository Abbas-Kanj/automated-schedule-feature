import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ShiftsDialogs } from './components/shifts-dialogs'
import { ShiftsProvider } from './components/shifts-provider'
import { ShiftsTable } from './components/shifts-table'
import { useShiftsStore } from './stores/shifts-store'

// Navigates to the "Create shift" page instead of opening a dialog — see
// `pages/create/shift-create-page.tsx`.
function ShiftsPrimaryButtons() {
  return (
    <Button className='space-x-1' asChild>
      <Link to='/shifts/new'>
        <span>Create Shift</span> <Plus size={18} />
      </Link>
    </Button>
  )
}

export function Shifts() {
  const shifts = useShiftsStore((s) => s.shifts)

  return (
    <ShiftsProvider>
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
              Shift management
            </h2>
            <p className='text-muted-foreground'>
              Define reusable shifts to assign across your schedules.
            </p>
          </div>
          <ShiftsPrimaryButtons />
        </div>
        <ShiftsTable data={shifts} />
      </Main>

      <ShiftsDialogs />
    </ShiftsProvider>
  )
}
