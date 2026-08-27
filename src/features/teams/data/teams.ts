import employeeData from '@/features/employees/data/data.json'
import { type Team } from './schema'

// Seed teams for the first load, before anything is persisted. Members are
// pulled from the bundled employee sample by index so the ids always match
// real seeded employees (hardcoding raw uuids would silently drift if the
// sample data changes). Team ids are stable literals — unlike created
// teams, these must survive a reload with the same identity.
const ids = employeeData.map((employee) => employee.id)

export const defaultTeams: Team[] = [
  {
    id: 'seed-team-engineering',
    name: 'Engineering',
    description: 'Product and platform engineers.',
    employee_ids: [ids[0], ids[6]].filter(Boolean) as string[],
  },
  {
    id: 'seed-team-operations',
    name: 'Operations',
    description: 'Day-to-day operations and facilities.',
    employee_ids: [ids[4], ids[8]].filter(Boolean) as string[],
  },
]
