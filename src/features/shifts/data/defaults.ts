import { buildDefaultDays } from '../utils'
import { type ShiftFormValues } from './schema'

// Shared "blank form" defaults for a brand-new shift — used by the
// "Create shift" page (see `pages/create/shift-create-page.tsx`). Kept
// separate from `shift-form-dialog.tsx` (edit-only now) so both it and the
// create page can import the same starting point without one depending on
// the other.
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
  // All 7 days start off — the "Shift times" tab's day toggles are opt-in,
  // not a pre-filled default week.
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
  // "Days" (frequency: 'daily') and "Never ends" are the Repeat tab's
  // defaults — pre-selected even while the tab's disabled, rather than
  // starting blank. `end_occurrences` gets a default too, so the "End
  // after" input isn't empty the moment it's switched to (see
  // `RepeatFields`'s always-visible end-settings inputs).
  repeat: { frequency: 'daily', end_type: 'never', end_occurrences: 1 },
  assign_to_enabled: false,
  work_type_group: undefined,
  service_resource: undefined,
  service_territory: undefined,
  employee_ids: [],
  team_ids: [],
}
