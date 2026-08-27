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

// Lunar holidays drift ~11 days earlier each Gregorian year, so these are
// seed values for the demo rather than anything computable. Multi-day ones
// carry a day count.
const MOVABLE_DEFINITIONS = [
  ['Eid Al-Fitr', 3, 20, 3],
  ['Eid Al-Adha', 5, 27, 3],
  ['Islamic New Year', 6, 17, 1],
  ['Ashoura', 6, 26, 1],
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

// The starting dataset for the year the app opens on: the fixed holidays
// plus the movable ones, so the Fixed filter has both values to show.
export function createSeedHolidays(year: number): PublicHoliday[] {
  const fixed = createFixedHolidays(year)
  const movable = MOVABLE_DEFINITIONS.map(
    ([name, month, day, days], index) => ({
      id: makeId(year, fixed.length + index),
      name,
      year,
      holiday_dates: Array.from({ length: days }, (_, offset) =>
        toDate(year, month, day + offset)
      ),
      fixed: false,
    })
  )
  return [...fixed, ...movable]
}
