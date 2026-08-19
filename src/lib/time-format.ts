import { useDisplayPreferencesStore } from '@/stores/display-preferences-store'

// Formats a stored "HH:mm" time for display — either as-is (24-hour) or
// converted to 12-hour with a lowercase am/pm suffix, e.g. "15:30" ->
// "3:30 pm". Anything that isn't a well-formed "HH:mm" string is passed
// through untouched (empty values, partially typed input, etc.).
export function formatClockTime(time: string, hour12: boolean): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return time
  if (!hour12) return time
  const hours = Number(match[1])
  const minutes = match[2]
  const period = hours >= 12 ? 'pm' : 'am'
  const displayHours = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHours}:${minutes} ${period}`
}

// Reads the user's preferred time format (see Settings > Display) and
// returns a bound formatter for it.
export function useTimeFormat() {
  const hour12 = useDisplayPreferencesStore(
    (s) => s.time_format === '12h'
  )
  return (time: string) => formatClockTime(time, hour12)
}
