import { type Team } from './schema'

// A team groups people; it does not by itself decide who works when — the
// schedule's "Assign to" step picks which crew covers which shift on which
// cycle day. Ids are stable literals rather than `generateId()` since
// seeded records need the same identity across reloads.
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
