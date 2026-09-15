import { type ZodType } from 'zod'

// Bump whenever bundled seed data changes and should win over a browser's
// cached copy — each store stamps the version it was seeded from and
// re-seeds when it's stale, so a stale cache doesn't silently shadow new defaults.
export const SEED_VERSION = '2026-09-15-no-schedule-seeds'

function seedStampKey(key: string): string {
  return `${key}:seed`
}

// Falls back to (and re-persists) `defaults` when nothing is stored, parsing
// fails, or the stored value is from an older SEED_VERSION.
export function readSeeded<T>(key: string, schema: ZodType<T>, defaults: T): T {
  const reseed = () => {
    writeSeeded(key, defaults)
    return defaults
  }

  if (localStorage.getItem(seedStampKey(key)) !== SEED_VERSION) return reseed()

  const raw = localStorage.getItem(key)
  if (raw === null) return reseed()

  try {
    const result = schema.safeParse(JSON.parse(raw))
    return result.success ? result.data : reseed()
  } catch {
    return reseed()
  }
}

export function writeSeeded<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
  localStorage.setItem(seedStampKey(key), SEED_VERSION)
}
