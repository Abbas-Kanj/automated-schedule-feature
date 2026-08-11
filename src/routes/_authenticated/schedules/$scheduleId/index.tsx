import { createFileRoute } from '@tanstack/react-router'
import { ScheduleViewPage } from '@/features/schedules/pages/view'

export const Route = createFileRoute('/_authenticated/schedules/$scheduleId/')({
  component: ScheduleViewPage,
})
