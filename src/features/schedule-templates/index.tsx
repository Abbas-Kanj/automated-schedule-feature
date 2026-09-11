import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ScheduleTemplatesDialogs } from './components/schedule-templates-dialogs'
import {
  ScheduleTemplatesProvider,
  useScheduleTemplates,
} from './components/schedule-templates-provider'
import { ScheduleTemplatesTable } from './components/schedule-templates-table'
import { useScheduleTemplatesStore } from './stores/schedule-templates-store'

function ScheduleTemplatesPrimaryButtons() {
  const { setOpen } = useScheduleTemplates()
  return (
    <Button className='space-x-1' onClick={() => setOpen('create')}>
      <span>Add template</span> <Plus size={18} />
    </Button>
  )
}

function ScheduleTemplatesContent() {
  const templates = useScheduleTemplatesStore((s) => s.templates)

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
              Schedule templates
            </h2>
            <p className='text-muted-foreground'>
              Working periods that override the normal hours for a date range.
            </p>
          </div>
          <ScheduleTemplatesPrimaryButtons />
        </div>
        <ScheduleTemplatesTable data={templates} />
      </Main>

      <ScheduleTemplatesDialogs />
    </>
  )
}

export function ScheduleTemplates() {
  return (
    <ScheduleTemplatesProvider>
      <ScheduleTemplatesContent />
    </ScheduleTemplatesProvider>
  )
}
