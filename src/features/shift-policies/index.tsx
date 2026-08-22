import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { PoliciesDialogs } from './components/policies-dialogs'
import { PoliciesProvider, usePolicies } from './components/policies-provider'
import { PoliciesTable } from './components/policies-table'
import { usePoliciesStore } from './stores/policies-store'

function PoliciesPrimaryButtons() {
  const { setOpen } = usePolicies()
  return (
    <Button className='space-x-1' onClick={() => setOpen('create')}>
      <span>Add new policy</span> <Plus size={18} />
    </Button>
  )
}

function ShiftPoliciesContent() {
  const policies = usePoliciesStore((s) => s.policies)

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
              Shift policies
            </h2>
            <p className='text-muted-foreground'>
              Define the rules that govern attendance across your shifts.
            </p>
          </div>
          <PoliciesPrimaryButtons />
        </div>
        <PoliciesTable data={policies} />
      </Main>

      <PoliciesDialogs />
    </>
  )
}

export function ShiftPolicies() {
  return (
    <PoliciesProvider>
      <ShiftPoliciesContent />
    </PoliciesProvider>
  )
}
