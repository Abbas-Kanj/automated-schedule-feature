import { createFileRoute } from '@tanstack/react-router'
import { Shifts } from '@/features/shifts'

export const Route = createFileRoute('/_authenticated/shifts/')({
  component: Shifts,
})
