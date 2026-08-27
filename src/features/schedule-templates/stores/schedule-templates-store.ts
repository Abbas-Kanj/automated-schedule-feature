import { z } from 'zod'
import { create } from 'zustand'
import { defaultScheduleTemplates } from '../data/schedule-templates'
import { type ScheduleTemplate, scheduleTemplateSchema } from '../data/schema'

const STORAGE_KEY = 'schedule-templates'

function readStoredTemplates(): ScheduleTemplate[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultScheduleTemplates

  try {
    const result = z.array(scheduleTemplateSchema).safeParse(JSON.parse(raw))
    return result.success ? result.data : defaultScheduleTemplates
  } catch {
    return defaultScheduleTemplates
  }
}

function persist(templates: ScheduleTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

interface ScheduleTemplatesState {
  templates: ScheduleTemplate[]
  addTemplate: (template: ScheduleTemplate) => void
  updateTemplate: (id: string, template: ScheduleTemplate) => void
  deleteTemplate: (id: string) => void
}

const initialTemplates = readStoredTemplates()
if (!localStorage.getItem(STORAGE_KEY)) {
  persist(initialTemplates)
}

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
