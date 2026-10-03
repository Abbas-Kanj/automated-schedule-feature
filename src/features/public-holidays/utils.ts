import { type PublicHoliday } from './data/schema'

// Ids are a human-readable code (HOL-2026-07); the year's existing ids are
// scanned to generate the next.
export function nextHolidayId(holidays: PublicHoliday[], year: number): string {
  const prefix = `HOL-${year}-`
  const highest = holidays
    .filter((holiday) => holiday.id.startsWith(prefix))
    .reduce((max, holiday) => {
      const sequence = Number(holiday.id.slice(prefix.length))
      return Number.isFinite(sequence) && sequence > max ? sequence : max
    }, 0)
  return `${prefix}${String(highest + 1).padStart(2, '0')}`
}
