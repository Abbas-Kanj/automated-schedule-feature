import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
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

export function ScheduleCreatePage() {
  const navigate = useNavigate()
  const addSchedule = useSchedulesStore((s) => s.addSchedule)

  const handleSubmit = (values: Schedule) => {
    addSchedule({ ...values, id: generateId() })
    toast.success(`Schedule "${values.name}" has been created.`)
    navigate({ to: '/schedules' })
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
          <h2 className='text-2xl font-bold tracking-tight'>
            Create schedule
          </h2>
          <p className='text-muted-foreground'>
            Choose a schedule type and fill in the details below.
          </p>
        </div>
        <ScheduleForm onSubmit={handleSubmit} />
      </Main>
    </>
  )
}
