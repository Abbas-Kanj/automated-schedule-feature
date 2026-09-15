import { type Schedule } from './schema'

// The app ships with no schedules — `/schedules` and `/schedule-rotation` both
// open empty until somebody creates one. Demo rotations live in
// `schedules.fixtures.ts`, imported by tests only.
export const defaultSchedules: Schedule[] = []
