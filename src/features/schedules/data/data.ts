import {
  DAYS_OF_WEEK,
  POLICY_TYPES,
  SHIFT_CYCLES,
  SHIFT_ROTATIONS_BY_CYCLE,
  type ShiftCycle,
} from './schema'

export const DAY_OPTIONS = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: day.charAt(0).toUpperCase() + day.slice(1),
}))

export const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export const SCHEDULE_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekly_one', label: 'Weekly One' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const POLICY_TYPE_OPTIONS = POLICY_TYPES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

export const SHIFT_CYCLE_OPTIONS = SHIFT_CYCLES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

const SHIFT_ROTATION_LABELS: Record<string, string> = {
  right_shift: 'Right shift',
  normal_rotation: 'Normal rotation',
  no_rotation: 'No rotation',
}

export function getShiftRotationOptions(cycle: ShiftCycle) {
  return SHIFT_ROTATIONS_BY_CYCLE[cycle].map((value) => ({
    value,
    label: SHIFT_ROTATION_LABELS[value],
  }))
}
