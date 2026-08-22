// Minutes since midnight for an "HH:mm" clock string — the unit every
// time-range comparison in this app works in (shift day ranges, break
// windows, policy rule windows).
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}
