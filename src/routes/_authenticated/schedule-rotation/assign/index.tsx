import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { ScheduleRotationAssignPage } from '@/features/schedule-rotation/pages/assign/schedule-rotation-assign-page'

// `/schedule-rotation`'s "Assign crews" button links here with
// `?scheduleId=...` so the picker opens pre-selected on the schedule the
// user was already looking at.
const searchSchema = z.object({
  scheduleId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/schedule-rotation/assign/')(
  {
    validateSearch: searchSchema,
    component: ScheduleRotationAssignPage,
  }
)
