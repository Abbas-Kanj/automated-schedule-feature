import { type Schedule } from './schema'

export const defaultSchedules: Schedule[] = [
  {
    id: 'sched-1',
    name: 'Front Desk Coverage',
    description: 'Reception coverage split across the morning and afternoon.',
    parent_type: 'daily',
    type: 'weekly_one',
    days: [
      {
        day: 'monday',
        times: [
          { from_time: '09:00', to_time: '13:00' },
          { from_time: '14:00', to_time: '17:00' },
        ],
      },
      {
        day: 'wednesday',
        times: [
          { from_time: '09:00', to_time: '13:00' },
          { from_time: '14:00', to_time: '17:00' },
        ],
      },
      {
        day: 'friday',
        times: [
          { from_time: '09:00', to_time: '13:00' },
          { from_time: '14:00', to_time: '17:00' },
        ],
      },
    ],
  },
  {
    id: 'sched-2',
    name: 'Warehouse Shift',
    description: 'Weekly warehouse coverage for the middle week of July.',
    parent_type: 'daily',
    type: 'weekly',
    year: 2026,
    month: 7,
    week: { start_date: '2026-07-12', end_date: '2026-07-18' },
    days: [
      {
        day: 'sunday',
        times: [{ from_time: '08:00', to_time: '16:00' }],
      },
      {
        day: 'tuesday',
        times: [{ from_time: '08:00', to_time: '16:00' }],
      },
      {
        day: 'thursday',
        times: [{ from_time: '10:00', to_time: '18:00' }],
      },
    ],
  },
  {
    id: 'sched-3',
    name: 'Quarterly Audit',
    description: 'On-site audit support across two months.',
    parent_type: 'daily',
    type: 'monthly',
    year: 2026,
    months: [
      {
        month: 8,
        days: [
          { day: 3, times: [{ from_time: '09:00', to_time: '12:00' }] },
          { day: 17, times: [{ from_time: '09:00', to_time: '12:00' }] },
        ],
      },
      {
        month: 11,
        days: [
          { day: 5, times: [{ from_time: '13:00', to_time: '17:00' }] },
        ],
      },
    ],
  },
]
