import { type Schedule } from './schema'

// The app ships with no schedules: `/schedules` and `/schedule-rotation` both
// open empty until somebody creates one. The demo rotations that used to live
// here moved to `schedules.fixtures.ts`, which is imported by tests only.
export const defaultSchedules: Schedule[] = []
