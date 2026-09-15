// No backend today — this is the single place to change when one arrives.
export function generateId() {
  return crypto.randomUUID()
}
