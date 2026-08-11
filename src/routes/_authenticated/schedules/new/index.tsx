import { createFileRoute } from '@tanstack/react-router'
import { ScheduleCreatePage } from '@/features/schedules/pages/create/schedule-create-page'

export const Route = createFileRoute('/_authenticated/schedules/new/')({
  component: ScheduleCreatePage,
})
