import { z } from 'zod'

export const SCHEDULE_TEMPLATE_STATUSES = [
  'upcoming',
  'tentative',
  'published',
] as const

export const SCHEDULE_TEMPLATE_PRIORITIES = ['high', 'medium', 'low'] as const

export type ScheduleTemplateStatus = (typeof SCHEDULE_TEMPLATE_STATUSES)[number]
export type ScheduleTemplatePriority =
  (typeof SCHEDULE_TEMPLATE_PRIORITIES)[number]

// A named working period: the date range it is in force for, and the daily
// time window it puts people on. `to_time` earlier than `from_time` means
// the window crosses midnight (see `getDurationMinutes`).
export const scheduleTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  from_time: z.string(),
  to_time: z.string(),
  status: z.enum(SCHEDULE_TEMPLATE_STATUSES),
  priority: z.enum(SCHEDULE_TEMPLATE_PRIORITIES),
})

export type ScheduleTemplate = z.infer<typeof scheduleTemplateSchema>
