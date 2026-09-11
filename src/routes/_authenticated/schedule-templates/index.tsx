import { createFileRoute } from '@tanstack/react-router'
import { ScheduleTemplates } from '@/features/schedule-templates'

export const Route = createFileRoute('/_authenticated/schedule-templates/')({
  component: ScheduleTemplates,
})
