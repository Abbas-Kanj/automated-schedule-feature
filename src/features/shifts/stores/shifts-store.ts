import { z } from 'zod'
import { create } from 'zustand'
import { generateId } from '@/lib/id'
import { readSeeded, writeSeeded } from '@/lib/seed-store'
import { type Shift, shiftSchema } from '../data/schema'
import { defaultShifts } from '../data/shifts'
import { deriveShortCode } from '../utils'

const STORAGE_KEY = 'shifts'

function persist(shifts: Shift[]) {
  writeSeeded(STORAGE_KEY, shifts)
}

interface ShiftsState {
  shifts: Shift[]
  addShift: (shift: Shift) => void
  updateShift: (id: string, shift: Shift) => void
  deleteShift: (id: string) => void
  cloneShift: (id: string) => void
}

const initialShifts = readSeeded(
  STORAGE_KEY,
  z.array(shiftSchema),
  defaultShifts
)

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
  cloneShift: (id) =>
    set((state) => {
      const source = state.shifts.find((s) => s.id === id)
      if (!source) return state

      const name = `${source.name} (Copy)`
      const clone: Shift = {
        ...source,
        id: generateId(),
        name,
        short_code: deriveShortCode(name),
      }
      const sourceIndex = state.shifts.indexOf(source)
      const shifts = [
        ...state.shifts.slice(0, sourceIndex + 1),
        clone,
        ...state.shifts.slice(sourceIndex + 1),
      ]
      persist(shifts)
      return { shifts }
    }),
}))
