import {
  SCHEDULE_TEMPLATE_PRIORITIES,
  SCHEDULE_TEMPLATE_STATUSES,
  type ScheduleTemplatePriority,
  type ScheduleTemplateStatus,
} from './schema'

const STATUS_LABELS: Record<ScheduleTemplateStatus, string> = {
  upcoming: 'Upcoming',
  tentative: 'Tentative',
  published: 'Published',
}

export const STATUS_OPTIONS = SCHEDULE_TEMPLATE_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

export function getStatusLabel(status: ScheduleTemplateStatus): string {
  return STATUS_LABELS[status]
}

const PRIORITY_LABELS: Record<ScheduleTemplatePriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_OPTIONS = SCHEDULE_TEMPLATE_PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}))

export function getPriorityLabel(priority: ScheduleTemplatePriority): string {
  return PRIORITY_LABELS[priority]
}
