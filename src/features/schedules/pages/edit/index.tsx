import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ScheduleForm } from '../../components/schedule-form/schedule-form'
import { type Schedule } from '../../data/schema'
import { useSchedulesStore } from '../../stores/schedules-store'

export function ScheduleEditPage() {
  // Params
  const { scheduleId } = useParams({
    from: '/_authenticated/schedules/$scheduleId/edit/',
  })

  // Zustand store
  const schedule = useSchedulesStore((s) =>
    s.schedules.find((sch) => sch.id === scheduleId)
  )

  const updateSchedule = useSchedulesStore((s) => s.updateSchedule)

  const handleSubmit = (values: Schedule) => {
    updateSchedule(values.id, values)
    toast.success(`Schedule "${values.name}" has been updated.`)
  }

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
          <h2 className='text-2xl font-bold tracking-tight'>Edit schedule</h2>
        </div>
        <ScheduleForm
          defaultValues={schedule}
          onSubmit={handleSubmit}
          submitLabel='Save changes'
        />
      </Main>
    </>
  )
}
