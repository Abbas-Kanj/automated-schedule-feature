import { createFileRoute } from '@tanstack/react-router'
import { ScheduleRotation } from '@/features/schedule-rotation'

export const Route = createFileRoute('/_authenticated/work-schedule/rotating/')(
  {
    component: ScheduleRotation,
  }
)
