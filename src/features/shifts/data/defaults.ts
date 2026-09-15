import { buildDefaultDays } from '../utils'
import { type ShiftFormValues } from './schema'

export const emptyShiftFormValues: ShiftFormValues = {
  name: '',
  short_code: '',
  badge_color: 'blue',
  icon: 'clock',
  shift_type: 'fixed',
  category: 'regular',
  custom_category: '',
  timezone_mode: 'local',
  timezone: undefined,
  hours_mode: 'same',
  // All 7 days start off — the day toggles are opt-in, not a pre-filled week.
  days: buildDefaultDays(
    {
      from_time: '09:00',
      to_time: '17:00',
      overnight: false,
    },
    false
  ),
  start_date: undefined,
  full_day_hours: undefined,
  half_day_hours: undefined,
  break_enabled: false,
  breaks: [],
  description: '',
  is_active: true,
  policy_ids: [],
  status: 'tentative',
  time_slot_type: 'regular',
  repeat_enabled: false,
  // Pre-selected even while the Repeat tab is disabled, rather than blank;
  // `end_occurrences` defaults too so "End after" isn't empty when switched to.
  repeat: { frequency: 'daily', end_type: 'never', end_occurrences: 1 },
  assign_to_enabled: false,
  work_type_group: undefined,
  service_resource: undefined,
  service_territory: undefined,
  employee_ids: [],
  team_ids: [],
}
