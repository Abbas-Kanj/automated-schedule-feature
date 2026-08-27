import { createFileRoute } from '@tanstack/react-router'
import { PublicHolidays } from '@/features/public-holidays'

export const Route = createFileRoute('/_authenticated/public-holidays/')({
  component: PublicHolidays,
})
