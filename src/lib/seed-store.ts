import { type ZodType } from 'zod'

// Bump this whenever the bundled seed data in a `features/*/data/*.ts` file
// changes and those changes should win over whatever a browser already has
// cached.
//
// Each persisted store stamps the version it was seeded from next to its
// records (under "<key>:seed"), so a cache written before the bump is
// dropped and re-seeded instead of silently shadowing the new defaults.
// Without this, editing a seed file has no visible effect on any browser
// that has already opened the app — the fix used to be hand-clearing every
// affected localStorage key, which is easy to forget and looks exactly like
// the seed edit not working.
export const SEED_VERSION = '2026-09-02-rotation-suggestion'

function seedStampKey(key: string): string {
  return `${key}:seed`
}

// Reads a persisted store's records, falling back to — and re-persisting —
// the bundled defaults whenever nothing is stored, the stored value no
// longer parses, or it was seeded from an older `SEED_VERSION`.
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

// Persists a store's records and re-stamps the seed version they belong to.
export function writeSeeded<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
  localStorage.setItem(seedStampKey(key), SEED_VERSION)
}
