import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOfficialHolidays } from './official-holidays-provider'

export function OfficialHolidaysPrimaryButtons() {
  const { setOpen } = useOfficialHolidays()
  return (
    <Button className='space-x-1' onClick={() => setOpen('add')}>
      <span>Add Official Holiday</span>
      <CalendarPlus size={18} />
    </Button>
  )
}
