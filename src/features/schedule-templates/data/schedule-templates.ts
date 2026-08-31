import { type ScheduleTemplate } from './schema'

// No seeded templates — the table opens on its empty state so templates can
// be created against the rotation scenario rather than sitting alongside
// unrelated sample rows.
export const defaultScheduleTemplates: ScheduleTemplate[] = []
