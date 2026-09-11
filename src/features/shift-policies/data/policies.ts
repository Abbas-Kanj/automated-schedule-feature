import { type ShiftPolicy } from './schema'

// No seeded policies — the three rotation shifts ship with an empty
// `policy_ids`, so attendance rules can be built up from scratch against
// the scenario rather than inherited from sample data. The store still
// falls back to this list when nothing is in localStorage yet (same pattern
// as `shifts/data/shifts.ts`).
export const defaultShiftPolicies: ShiftPolicy[] = []
