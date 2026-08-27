import { type ScheduleTemplate } from './schema'

const YEAR = new Date().getFullYear()

// Four templates covering every status and priority, so the table's faceted
// filters have something to bite on out of the box. The maintenance one
// runs overnight, which is what exercises the wrapping duration.
export const defaultScheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'schedule-template-1',
    name: 'Summer hours',
    description: 'Earlier start and finish while the clocks are forward.',
    start_date: new Date(YEAR, 5, 1),
    end_date: new Date(YEAR, 8, 30),
    from_time: '08:00',
    to_time: '16:00',
    status: 'published',
    priority: 'high',
  },
  {
    id: 'schedule-template-2',
    name: 'Maintenance window',
    description: 'Overnight cover while the plant is being serviced.',
    start_date: new Date(YEAR, 9, 1),
    end_date: new Date(YEAR, 9, 15),
    from_time: '20:00',
    to_time: '04:00',
    status: 'tentative',
    priority: 'medium',
  },
  {
    id: 'schedule-template-3',
    name: 'Ramadan hours',
    description: 'Shortened working day for the month.',
    start_date: new Date(YEAR, 1, 17),
    end_date: new Date(YEAR, 2, 19),
    from_time: '09:00',
    to_time: '15:00',
    status: 'upcoming',
    priority: 'high',
  },
  {
    id: 'schedule-template-4',
    name: 'Year-end skeleton crew',
    description: 'Reduced cover between Christmas and the new year.',
    start_date: new Date(YEAR, 11, 26),
    end_date: new Date(YEAR, 11, 31),
    from_time: '10:00',
    to_time: '14:30',
    status: 'upcoming',
    priority: 'low',
  },
]
