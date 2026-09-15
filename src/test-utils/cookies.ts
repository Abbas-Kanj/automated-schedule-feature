import { removeCookie } from '@/lib/cookies'

// Removes cookies for test isolation; `filter` is a name prefix or RegExp, omit to clear all.
export function clearCookies(filter?: string | RegExp): void {
  if (typeof document === 'undefined') return

  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (!name) continue

    const shouldRemove =
      filter === undefined
        ? true
        : typeof filter === 'string'
          ? name.startsWith(filter)
          : filter.test(name)

    if (shouldRemove) {
      removeCookie(name)
    }
  }
}
