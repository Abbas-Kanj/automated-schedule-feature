import { z } from 'zod'

export const officialHolidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number().int(),
  holidayDates: z.array(z.coerce.date()).min(1),
  rigid: z.boolean(),
})

export type OfficialHoliday = z.infer<typeof officialHolidaySchema>

export type HolidayYear = {
  year: number
  isOpen: boolean
}
