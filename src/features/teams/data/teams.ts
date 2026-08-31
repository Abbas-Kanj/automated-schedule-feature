import { type Team } from './schema'

// The two crews the seeded rotations draw from — see
// `features/schedules/data/schedules.ts`. A team groups people; it does not
// by itself decide who works when. The schedule's "Assign to" step picks
// which member starts on which cycle position, which is what the Schedule
// Rotation screen reads (see `features/schedule-rotation`).
//
// Each team is sized to its rotation: a cycle has one position per shift
// plus a rest slot, and one crew per position, so three shifts want four
// people and two shifts want three. Fewer and some position starts empty;
// more and the extras never enter the cycle.
//
// Ids are stable literals rather than `generateId()` — seeded records have
// to keep the same identity across reloads for the schedules referencing
// them to resolve.
export const defaultTeams: Team[] = [
  {
    id: 'team-a',
    name: 'Team A',
    description:
      'Floor crew — rotates Morning, Afternoon, Night and a rest day.',
    employee_ids: ['emp-a', 'emp-b', 'emp-c', 'emp-d'],
  },
  {
    id: 'team-b',
    name: 'Team B',
    description: 'Desk crew — alternates Early, Late and a rest day.',
    employee_ids: ['emp-e', 'emp-f', 'emp-g'],
  },
]
