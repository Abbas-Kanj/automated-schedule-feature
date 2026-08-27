import { z } from 'zod'

export const publicHolidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number().int(),
  holiday_dates: z.array(z.coerce.date()).min(1),
  // Whether the holiday lands on the same calendar date every year (New
  // Year's Day) or moves (the lunar ones). Drives the Fixed column and its
  // faceted filter.
  fixed: z.boolean(),
})

export type PublicHoliday = z.infer<typeof publicHolidaySchema>

export type HolidayYear = {
  year: number
  isOpen: boolean
}
