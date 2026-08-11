import { createFileRoute } from '@tanstack/react-router'
import { ScheduleEditPage } from '@/features/schedules/pages/edit'

export const Route = createFileRoute(
  '/_authenticated/schedules/$scheduleId/edit/'
)({
  component: ScheduleEditPage,
})
