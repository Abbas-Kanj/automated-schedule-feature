import { z } from 'zod'
import { create } from 'zustand'
import { defaultSchedules } from '../data/schedules'
import { type Schedule, scheduleSchema } from '../data/schema'
import { generateId } from '../utils'

const STORAGE_KEY = 'schedules'

function readStoredSchedules(): Schedule[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultSchedules

  try {
    const result = z.array(scheduleSchema).safeParse(JSON.parse(raw))
    return result.success ? result.data : defaultSchedules
  } catch {
    return defaultSchedules
  }
}

function persist(schedules: Schedule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
}

interface SchedulesState {
  schedules: Schedule[]
  addSchedule: (schedule: Schedule) => void
  updateSchedule: (id: string, schedule: Schedule) => void
  cloneSchedule: (schedule: Schedule) => Schedule
  deleteSchedule: (id: string) => void
}

const initialSchedules = readStoredSchedules()
if (!localStorage.getItem(STORAGE_KEY)) {
  persist(initialSchedules)
}

export const useSchedulesStore = create<SchedulesState>()((set) => ({
  schedules: initialSchedules,
  addSchedule: (schedule) =>
    set((state) => {
      const schedules = [...state.schedules, schedule]
      persist(schedules)
      return { schedules }
    }),
  updateSchedule: (id, schedule) =>
    set((state) => {
      const schedules = state.schedules.map((s) => (s.id === id ? schedule : s))
      persist(schedules)
      return { schedules }
    }),
  cloneSchedule: (schedule) => {
    const cloned = {
      ...schedule,
      id: generateId(),
      name: `${schedule.name} (copy)`,
    }
    set((state) => {
      const schedules = [...state.schedules, cloned]
      persist(schedules)
      return { schedules }
    })
    return cloned
  },
  deleteSchedule: (id) =>
    set((state) => {
      const schedules = state.schedules.filter((s) => s.id !== id)
      persist(schedules)
      return { schedules }
    }),
}))
