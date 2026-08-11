import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { useSchedulesStore } from '../stores/schedules-store'
import { ScheduleForm } from './schedule-form/schedule-form'

export function ScheduleViewPage() {
  const { scheduleId } = useParams({
    from: '/_authenticated/schedules/$scheduleId/',
  })
  const schedule = useSchedulesStore((s) =>
    s.schedules.find((sch) => sch.id === scheduleId)
  )

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <Button variant='ghost' size='sm' asChild className='-ms-3 mb-1'>
            <Link to='/schedules'>
              <ArrowLeft className='size-4' /> Back to schedules
            </Link>
          </Button>
          <h2 className='text-2xl font-bold tracking-tight'>View schedule</h2>
          <p className='text-muted-foreground'>
            {schedule
              ? 'These details are read-only.'
              : 'This schedule could not be found.'}
          </p>
        </div>
        {schedule && (
          <ScheduleForm
            defaultValues={schedule}
            onSubmit={() => {}}
            disabled
          />
        )}
      </Main>
    </>
  )
}
