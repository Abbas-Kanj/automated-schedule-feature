// Client-side id for locally-created records (schedules, shifts, shift
// policies and their rules). There's no backend today — when one arrives,
// this is the single place that changes.
export function generateId() {
  return crypto.randomUUID()
}
