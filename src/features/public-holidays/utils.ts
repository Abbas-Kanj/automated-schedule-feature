import { type PublicHoliday } from './data/schema'

// Holiday ids are the human-readable code shown in the table (HOL-2026-07),
// not a uuid — so a new one continues that year's sequence instead of coming
// from `lib/id.ts`. Scanning the year's existing ids keeps it collision-free
// after deletes.
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
