import { z } from 'zod'
import { create } from 'zustand'
import { defaultShifts } from '../data/shifts'
import { type Shift, shiftSchema } from '../data/schema'

const STORAGE_KEY = 'shifts'

function readStoredShifts(): Shift[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultShifts

  try {
    const result = z.array(shiftSchema).safeParse(JSON.parse(raw))
    return result.success ? result.data : defaultShifts
  } catch {
    return defaultShifts
  }
}

function persist(shifts: Shift[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts))
}

interface ShiftsState {
  shifts: Shift[]
  addShift: (shift: Shift) => void
  updateShift: (id: string, shift: Shift) => void
  deleteShift: (id: string) => void
}

const initialShifts = readStoredShifts()
if (!localStorage.getItem(STORAGE_KEY)) {
  persist(initialShifts)
}

export const useShiftsStore = create<ShiftsState>()((set) => ({
  shifts: initialShifts,
  addShift: (shift) =>
    set((state) => {
      const shifts = [...state.shifts, shift]
      persist(shifts)
      return { shifts }
    }),
  updateShift: (id, shift) =>
    set((state) => {
      const shifts = state.shifts.map((s) => (s.id === id ? shift : s))
      persist(shifts)
      return { shifts }
    }),
  deleteShift: (id) =>
    set((state) => {
      const shifts = state.shifts.filter((s) => s.id !== id)
      persist(shifts)
      return { shifts }
    }),
}))
