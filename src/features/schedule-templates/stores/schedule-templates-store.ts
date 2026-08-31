import { z } from 'zod'
import { create } from 'zustand'
import { readSeeded, writeSeeded } from '@/lib/seed-store'
import { defaultScheduleTemplates } from '../data/schedule-templates'
import { type ScheduleTemplate, scheduleTemplateSchema } from '../data/schema'

const STORAGE_KEY = 'schedule-templates'

function persist(templates: ScheduleTemplate[]) {
  writeSeeded(STORAGE_KEY, templates)
}

interface ScheduleTemplatesState {
  templates: ScheduleTemplate[]
  addTemplate: (template: ScheduleTemplate) => void
  updateTemplate: (id: string, template: ScheduleTemplate) => void
  deleteTemplate: (id: string) => void
}

const initialTemplates = readSeeded(
  STORAGE_KEY,
  z.array(scheduleTemplateSchema),
  defaultScheduleTemplates
)

export const useScheduleTemplatesStore = create<ScheduleTemplatesState>()(
  (set) => ({
    templates: initialTemplates,
    addTemplate: (template) =>
      set((state) => {
        const templates = [...state.templates, template]
        persist(templates)
        return { templates }
      }),
    updateTemplate: (id, template) =>
      set((state) => {
        const templates = state.templates.map((t) =>
          t.id === id ? template : t
        )
        persist(templates)
        return { templates }
      }),
    deleteTemplate: (id) =>
      set((state) => {
        const templates = state.templates.filter((t) => t.id !== id)
        persist(templates)
        return { templates }
      }),
  })
)
