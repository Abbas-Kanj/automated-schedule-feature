import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { TeamsDialogs } from './components/teams-dialogs'
import { TeamsProvider, useTeams } from './components/teams-provider'
import { TeamsTable } from './components/teams-table'
import { useTeamsStore } from './stores/teams-store'

function TeamsPrimaryButtons() {
  const { setOpen } = useTeams()
  return (
    <Button className='space-x-1' onClick={() => setOpen('create')}>
      <span>Add new team</span> <Plus size={18} />
    </Button>
  )
}

function TeamsContent() {
  const teams = useTeamsStore((s) => s.teams)

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
              Team Management
            </h2>
            <p className='text-muted-foreground'>
              Group your employees into teams and manage their members here.
            </p>
          </div>
          <TeamsPrimaryButtons />
        </div>
        <TeamsTable data={teams} />
      </Main>

      <TeamsDialogs />
    </>
  )
}

export function Teams() {
  return (
    <TeamsProvider>
      <TeamsContent />
    </TeamsProvider>
  )
}
