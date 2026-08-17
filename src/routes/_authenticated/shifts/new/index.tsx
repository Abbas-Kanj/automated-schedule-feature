import { createFileRoute } from '@tanstack/react-router'
import { ShiftCreatePage } from '@/features/shifts/pages/create/shift-create-page'

export const Route = createFileRoute('/_authenticated/shifts/new/')({
  component: ShiftCreatePage,
})
