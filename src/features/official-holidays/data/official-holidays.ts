import { type OfficialHoliday } from './schema'

export const officialHolidays: OfficialHoliday[] = [
  {
    id: 'HOL-001',
    name: "New Year's Day",
    year: 2026,
    holidayDates: [new Date('2026-01-01T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-002',
    name: 'Eid Al-Fitr',
    year: 2026,
    holidayDates: [
      new Date('2026-03-20T00:00:00'),
      new Date('2026-03-21T00:00:00'),
      new Date('2026-03-22T00:00:00'),
    ],
    rigid: true,
  },
  {
    id: 'HOL-003',
    name: 'Labour Day',
    year: 2026,
    holidayDates: [new Date('2026-05-01T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-004',
    name: 'Liberation Day',
    year: 2026,
    holidayDates: [new Date('2026-05-25T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-005',
    name: 'Eid Al-Adha',
    year: 2026,
    holidayDates: [
      new Date('2026-05-27T00:00:00'),
      new Date('2026-05-28T00:00:00'),
      new Date('2026-05-29T00:00:00'),
    ],
    rigid: true,
  },
  {
    id: 'HOL-006',
    name: 'Islamic New Year',
    year: 2026,
    holidayDates: [new Date('2026-06-17T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-007',
    name: 'Ashoura',
    year: 2026,
    holidayDates: [new Date('2026-06-26T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-008',
    name: 'Assumption Day',
    year: 2026,
    holidayDates: [new Date('2026-08-15T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-009',
    name: 'Independence Day',
    year: 2026,
    holidayDates: [new Date('2026-11-22T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-010',
    name: 'Christmas Day',
    year: 2026,
    holidayDates: [new Date('2026-12-25T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-011',
    name: 'Ashoura',
    year: 2026,
    holidayDates: [new Date('2026-06-26T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-012',
    name: 'Test1 Day',
    year: 2026,
    holidayDates: [new Date('2026-08-15T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-013',
    name: 'Test2 Day',
    year: 2026,
    holidayDates: [new Date('2026-11-22T00:00:00')],
    rigid: true,
  },
  {
    id: 'HOL-014',
    name: 'Test3 Day',
    year: 2026,
    holidayDates: [new Date('2026-12-25T00:00:00')],
    rigid: true,
  },
]

export const createPredefinedHolidays = (year: number): OfficialHoliday[] => {
  const definitions = [
    ["New Year's Day", 1, 1],
    ['Labour Day', 5, 1],
    ['Liberation Day', 5, 25],
    ['Assumption Day', 8, 15],
    ['Independence Day', 11, 22],
    ['Christmas Day', 12, 25],
  ] as const

  return definitions.map(([name, month, day], index) => ({
    id: `HOL-${year}-${String(index + 1).padStart(2, '0')}`,
    name,
    year,
    holidayDates: [
      new Date(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
      ),
    ],
    rigid: true,
  }))
}
