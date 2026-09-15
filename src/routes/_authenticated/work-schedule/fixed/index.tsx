import { createFileRoute } from '@tanstack/react-router'
import { FixedWorkSchedule } from '@/features/fixed-work-schedule'

export const Route = createFileRoute('/_authenticated/work-schedule/fixed/')({
  component: FixedWorkSchedule,
})
