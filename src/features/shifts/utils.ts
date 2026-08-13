import { differenceInMinutes, parse } from 'date-fns'

export function generateId() {
  return crypto.randomUUID()
}

export function deriveShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 6).toUpperCase()
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 6)
    .toUpperCase()
}

export function calculateShiftHours(
  from_time: string,
  to_time: string,
  overnight?: boolean
): number {
  if (!from_time || !to_time) return 0
  const from = parse(from_time, 'HH:mm', new Date())
  const to = parse(to_time, 'HH:mm', new Date())
  const diff = differenceInMinutes(to, from)
  // A range that ends before it starts (e.g. an overnight 22:00 -> 06:00
  // entry) is treated as crossing midnight rather than a negative duration.
  const totalMinutes = overnight || diff < 0 ? diff + 24 * 60 : diff

  return Math.round((totalMinutes / 60) * 100) / 100
}
