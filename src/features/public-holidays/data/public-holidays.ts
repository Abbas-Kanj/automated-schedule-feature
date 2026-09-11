import { type PublicHoliday } from './schema'

// Holidays that fall on the same calendar date every year. Opening a new
// year pre-fills exactly these — everything else has to be entered by hand
// once its date is known.
const FIXED_DEFINITIONS = [
  ["New Year's Day", 1, 1],
  ['Labour Day', 5, 1],
  ['Liberation Day', 5, 25],
  ['Assumption Day', 8, 15],
  ['Independence Day', 11, 22],
  ['Christmas Day', 12, 25],
] as const

function toDate(year: number, month: number, day: number) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00`)
}

function makeId(year: number, index: number) {
  return `HOL-${year}-${String(index + 1).padStart(2, '0')}`
}

// The fixed-date holidays for a year — what `openYear` seeds a newly
// opened year with.
export function createFixedHolidays(year: number): PublicHoliday[] {
  return FIXED_DEFINITIONS.map(([name, month, day], index) => ({
    id: makeId(year, index),
    name,
    year,
    holiday_dates: [toDate(year, month, day)],
    fixed: true,
  }))
}
