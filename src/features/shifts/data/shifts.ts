import { type Shift } from './schema'

export const defaultShifts: Shift[] = [
  {
    id: 'shift-morning',
    name: 'Morning',
    short_code: 'MORN',
    badge_color: 'amber',
    icon: 'sunrise',
    from_time: '06:00',
    to_time: '14:00',
    overnight: false,
    description: 'Early shift covering store opening.',
  },
  {
    id: 'shift-afternoon',
    name: 'Afternoon',
    short_code: 'AFT',
    badge_color: 'sky',
    icon: 'sun',
    from_time: '14:00',
    to_time: '22:00',
    overnight: false,
    description: 'Mid-day shift covering peak hours.',
  },
  {
    id: 'shift-night',
    name: 'Night',
    short_code: 'NIGHT',
    badge_color: 'indigo',
    icon: 'moon',
    from_time: '22:00',
    to_time: '06:00',
    overnight: true,
    description: 'Overnight shift covering store closing.',
  },
]
