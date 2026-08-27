import { z } from 'zod'
import { create } from 'zustand'
import {
  createFixedHolidays,
  createSeedHolidays,
} from '../data/public-holidays'
import { type PublicHoliday, publicHolidaySchema } from '../data/schema'

const STORAGE_KEY = 'public-holidays'

const CURRENT_YEAR = new Date().getFullYear()

// The year picker offers the current year and the four after it. Only years
// that have been opened hold holidays.
export const HOLIDAY_YEARS = Array.from(
  { length: 5 },
  (_, index) => CURRENT_YEAR + index
)

const storedSchema = z.object({
  holidays: z.array(publicHolidaySchema),
  open_years: z.array(z.number().int()),
})

type StoredState = z.infer<typeof storedSchema>

function defaultState(): StoredState {
  return {
    holidays: createSeedHolidays(CURRENT_YEAR),
    open_years: [CURRENT_YEAR],
  }
}

function readStoredState(): StoredState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultState()

  try {
    const result = storedSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : defaultState()
  } catch {
    return defaultState()
  }
}

function persist(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

interface PublicHolidaysState extends StoredState {
  saveHoliday: (holiday: PublicHoliday) => void
  deleteHoliday: (id: string) => void
  deleteHolidays: (ids: string[]) => void
  openYear: (year: number) => void
}

const initialState = readStoredState()
if (!localStorage.getItem(STORAGE_KEY)) {
  persist(initialState)
}

export const usePublicHolidaysStore = create<PublicHolidaysState>()((set) => ({
  ...initialState,
  saveHoliday: (holiday) =>
    set((state) => {
      const exists = state.holidays.some((h) => h.id === holiday.id)
      const holidays = exists
        ? state.holidays.map((h) => (h.id === holiday.id ? holiday : h))
        : [...state.holidays, holiday]
      persist({ holidays, open_years: state.open_years })
      return { holidays }
    }),
  deleteHoliday: (id) =>
    set((state) => {
      const holidays = state.holidays.filter((h) => h.id !== id)
      persist({ holidays, open_years: state.open_years })
      return { holidays }
    }),
  deleteHolidays: (ids) =>
    set((state) => {
      const removed = new Set(ids)
      const holidays = state.holidays.filter((h) => !removed.has(h.id))
      persist({ holidays, open_years: state.open_years })
      return { holidays }
    }),
  openYear: (year) =>
    set((state) => {
      if (state.open_years.includes(year)) return state
      const holidays = [...state.holidays, ...createFixedHolidays(year)]
      const open_years = [...state.open_years, year]
      persist({ holidays, open_years })
      return { holidays, open_years }
    }),
}))
