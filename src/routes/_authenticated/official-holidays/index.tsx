import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { OfficialHolidays } from '@/features/official-holidays'

const officialHolidaysSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  name: z.string().optional().catch(''),
  rigid: z
    .array(z.enum(['yes', 'no']))
    .optional()
    .catch([]),
})

export const Route = createFileRoute('/_authenticated/official-holidays/')({
  validateSearch: officialHolidaysSearchSchema,
  component: OfficialHolidays,
})
