import { useMemo } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { PublicHolidaysDialogs } from './components/public-holidays-dialogs'
import {
  PublicHolidaysProvider,
  usePublicHolidays,
} from './components/public-holidays-provider'
import { PublicHolidaysTable } from './components/public-holidays-table'
import {
  HOLIDAY_YEARS,
  usePublicHolidaysStore,
} from './stores/public-holidays-store'

function PublicHolidaysContent() {
  const { selectedYear, setSelectedYear, setOpen } = usePublicHolidays()
  const holidays = usePublicHolidaysStore((s) => s.holidays)
  const openYears = usePublicHolidaysStore((s) => s.open_years)
  const openYear = usePublicHolidaysStore((s) => s.openYear)

  const isYearOpen = openYears.includes(selectedYear)
  const yearHolidays = useMemo(
    () => holidays.filter((holiday) => holiday.year === selectedYear),
    [holidays, selectedYear]
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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Public holidays
            </h2>
            <p className='text-muted-foreground'>
              Manage the days your organisation closes, one year at a time.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Select
              value={String(selectedYear)}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className='w-28' aria-label='Select year'>
                <SelectValue placeholder='Year' />
              </SelectTrigger>
              <SelectContent>
                {HOLIDAY_YEARS.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isYearOpen ? (
              <Button className='space-x-1' onClick={() => setOpen('create')}>
                <span>Add holiday</span> <CalendarPlus size={18} />
              </Button>
            ) : (
              <Button variant='outline' onClick={() => openYear(selectedYear)}>
                Open {selectedYear}
              </Button>
            )}
          </div>
        </div>

        {isYearOpen ? (
          // Remounting on year change resets pagination, sorting and any
          // row selection carried over from the year before.
          <PublicHolidaysTable key={selectedYear} data={yearHolidays} />
        ) : (
          <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-10 text-center'>
            <p className='font-medium'>{selectedYear} has not been opened</p>
            <p className='text-sm text-muted-foreground'>
              Opening a year fills it with the holidays that fall on the same
              date every year. The rest you add yourself.
            </p>
          </div>
        )}
      </Main>

      <PublicHolidaysDialogs />
    </>
  )
}

export function PublicHolidays() {
  return (
    <PublicHolidaysProvider>
      <PublicHolidaysContent />
    </PublicHolidaysProvider>
  )
}
