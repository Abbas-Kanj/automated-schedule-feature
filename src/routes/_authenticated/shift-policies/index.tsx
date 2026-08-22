import { createFileRoute } from '@tanstack/react-router'
import { ShiftPolicies } from '@/features/shift-policies'

export const Route = createFileRoute('/_authenticated/shift-policies/')({
  component: ShiftPolicies,
})
