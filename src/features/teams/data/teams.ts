import { type Team } from './schema'

// The crews the sample rotation scenarios draw from (see
// `features/schedules/data/schedules.fixtures.ts`; the app ships with no
// schedules of its own). A team groups people; it does
// not by itself decide who works when. The schedule's "Assign to" step picks
// which crew covers which shift on which cycle day, which is what the
// Schedule Rotation screen reads (see `features/schedule-rotation`).
//
// Ids are stable literals rather than `generateId()` — seeded records have
// to keep the same identity across reloads for anything referencing them to
// resolve.
//
//   Team A / Team B          the two small demo rotations (Shift Rotation,
//                            Desk Alternation) — one crew per cycle position.
//   Guard Alpha…Delta        one 24/7 security force, run two ways: the
//                            28-day DuPont site patrol and the 14-day 2-2-3
//                            guard roster.
//   Line Blue…Green          one factory line crew, run two ways: the 8-day
//                            Continental and the 28-day Southern Swing.
//
// The hospital ward rotation is staffed by four individually-picked nurses
// (crews of one), not a team — see `schedules/data/schedules.fixtures.ts`.
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

  // --- Security: one guard force, four crews, 12-hour day/night ---
  {
    id: 'team-sec-alpha',
    name: 'Guard Alpha',
    description: 'Security crew — 12-hour day and night watches.',
    employee_ids: ['emp-h', 'emp-i'],
  },
  {
    id: 'team-sec-bravo',
    name: 'Guard Bravo',
    description: 'Security crew — 12-hour day and night watches.',
    employee_ids: ['emp-j', 'emp-k'],
  },
  {
    id: 'team-sec-charlie',
    name: 'Guard Charlie',
    description: 'Security crew — 12-hour day and night watches.',
    employee_ids: ['emp-l', 'emp-m'],
  },
  {
    id: 'team-sec-delta',
    name: 'Guard Delta',
    description: 'Security crew — 12-hour day and night watches.',
    employee_ids: ['emp-n', 'emp-o'],
  },

  // --- Factory: one continuous line, four crews, three 8-hour shifts ---
  {
    id: 'team-fac-blue',
    name: 'Line Blue',
    description: 'Production crew — rotates through Morning, Afternoon, Night.',
    employee_ids: ['emp-p', 'emp-q'],
  },
  {
    id: 'team-fac-gold',
    name: 'Line Gold',
    description: 'Production crew — rotates through Morning, Afternoon, Night.',
    employee_ids: ['emp-r', 'emp-s'],
  },
  {
    id: 'team-fac-red',
    name: 'Line Red',
    description: 'Production crew — rotates through Morning, Afternoon, Night.',
    employee_ids: ['emp-t', 'emp-u'],
  },
  {
    id: 'team-fac-green',
    name: 'Line Green',
    description: 'Production crew — rotates through Morning, Afternoon, Night.',
    employee_ids: ['emp-v', 'emp-w'],
  },

  // --- Head office: a single weekday crew for the fixed Mon–Fri schedule ---
  {
    id: 'team-office',
    name: 'Head Office',
    description: 'Administration — standard Monday-to-Friday office hours.',
    employee_ids: ['emp-bb', 'emp-cc', 'emp-dd'],
  },
]
