import { z } from 'zod'

// Minutes since midnight for an "HH:mm" clock string — the unit every
// time-range comparison in this app works in (shift day ranges, break
// windows, policy rule windows).
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// A 24-hour "HH:mm" clock string, as every time field in this app stores it.
export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required')
