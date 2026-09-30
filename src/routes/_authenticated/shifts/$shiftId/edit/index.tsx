import { createFileRoute } from '@tanstack/react-router'
import { ShiftEditPage } from '@/features/shifts/pages/shift-form-page'

export const Route = createFileRoute('/_authenticated/shifts/$shiftId/edit/')({
  component: ShiftEditPage,
})
