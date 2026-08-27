# Handoff — public-holidays + schedule-templates (2026-08-26)

Pulled the two screens Mahmoud built on `../schedule-feature` @
`mahmoud-branch` (commits `a37ebb5` publicHoliday, `509adfd`/`479b4bb`/
`059f882` ScheduleTemp) and rewrote them onto this repo's conventions.
Nothing was copied verbatim.

## What landed

### `src/features/public-holidays/` — **replaces `official-holidays`**

Their commit was itself a rename+rework of the screen we already had
(`rigid` → `fixed`), so keeping both would have meant two duplicate holiday
screens. `official-holidays` and its route are **deleted** (`git rm`); the
sidebar's Holidays entry is now **Public holidays → `/public-holidays`**.

Kept from their version: the calendar multi-select UX (the calendar *is* the
field — no more two-step "select dates, then press Add date"), the `fixed`
naming, the leaner column set.

Kept from ours: **row selection + bulk delete**, which their commit had
deleted.

### `src/features/schedule-templates/` — new, route `/schedule-templates`

Their "Schedule Temp". Renamed because `schedules`' own schema already has
a `temporary_schedule: boolean` + `temporary_schedule_label`
(`schedules/data/schema.ts:159`) which is a *different* concept — naming
this one `temporary-schedules` would have collided. `schedule-templates`
matches their own page description. Sidebar: **Time Track → Schedules →
Schedule templates**.

## How they were adapted

| Theirs | Ours |
|---|---|
| Hand-rolled `useReactTable` + full table markup in each table file | shared `DataTable` (see below) |
| `useState` in the page / provider | zustand + `localStorage`, mirroring `policies-store.ts` |
| local `toMinutes` re-implementation in `data/duration.ts` | `lib/time.ts#toMinutes`, helpers in `<feature>/utils.ts` |
| `crypto.randomUUID()` inline | `lib/id.ts#generateId` |
| camelCase schema fields (`fromDate`, `timeFrom`, `holidayDates`) | snake_case (`start_date`, `from_time`, `holiday_dates`) — matches `schedules`/`shifts`/`shift-policies` |
| hardcoded Tailwind palette maps (`bg-amber-100/60 dark:bg-amber-950/50` …) | `Badge` variants (theme tokens) — repo has no raw palette maps outside `apps/` boilerplate |
| raw `timeFrom` in the table | `useTimeFormat()` — respects Settings → Display 12h/24h |
| `data/fixed-options.ts`, `data/duration.ts` | `data/data.ts` label maps + `*_OPTIONS`, `utils.ts` |
| pencil-icon edit button only | `data-table-row-actions.tsx` dropdown (Edit + Delete) |
| `showSubmittedData` JSON-dump toast | `toast.success` with a human message (matches `shift-policies`) |
| `useTableUrlState` + `validateSearch` on the route | dropped — the shared `DataTable` keeps filter/pagination state locally, like the other tables |

## Shared `DataTable` was extended

`src/components/data-table/data-table.tsx` gained four optional props so
both screens could use it instead of hand-rolling:

- `searchKey` — search one column instead of the global filter
- `filters` — faceted dropdown filters (also wired `getFacetedRowModel` /
  `getFacetedUniqueValues`, needed for the option counts)
- `bulkActions` — render prop; **passing it is what enables row selection**
- plus `data-state={row.getIsSelected() && 'selected'}` on rows

Additive — schedules / shifts / shift-policies pass none of them and are
unaffected. This also closes the open call in CLAUDE.md about the pulled
tables bypassing the shared `DataTable`.

## Deliberate changes worth reviewing

1. **Holiday IDs are no longer typed by hand.** Their form had an editable
   `ID` field with no uniqueness check — entering an existing id silently
   *overwrote* that holiday via `saveHoliday`'s `exists` branch. New
   holidays now get `HOL-<year>-<nn>` from `utils.ts#nextHolidayId`, and
   the ID column is gone (it's an internal key now).
2. **`fixed` now means something.** Their seed marked all ten holidays
   `fixed: true`, so the column and its filter were dead weight. Seed is
   now 6 genuinely fixed-date holidays (`fixed: true`) + 4 lunar ones
   (`fixed: false`), generated for the current year rather than hardcoded
   to 2026. `openYear` still seeds only the 6 fixed ones.
3. **Bulk delete actually deletes.** The old `official-holidays`
   multi-delete dialog only fired a `toast.promise(sleep(1000))` and reset
   the selection — rows came back. It now calls `deleteHolidays`.
4. **Unopened years get an empty state** instead of an empty table.
5. `schedule-templates` seed is 4 records (was 2) covering every status and
   priority, so the faceted filters have something to show.

## State

- **Committed and pushed to `main`** on 2026-08-27, as `d054452` — part of
  a 9-commit session that organized and shipped every feature that had
  piled up uncommitted. No code changed in that session, only commit
  organization.
- `npm run build` **clean**; route tree regenerated (both routes present,
  no `official-holidays` refs anywhere in `src/`).
- `npx eslint` **clean** on all new files + the `DataTable` change.
- **Full suite now runs clean, in real browser mode**: 174 passed / 3
  failed (the 3 are the pre-existing unowned `search-provider.test.tsx`
  failures) — supersedes the 60/3 `--environment=node` partial run below,
  which was constrained by a vitest port-bind issue that did not
  reproduce on 2026-08-27 (see the next section).
- **NOT browser-verified** — still true, no browser tooling connected in
  any session for this feature yet.

## Gotchas for next session

- **Vitest browser mode port-bind issue did NOT reproduce on 2026-08-27.**
  Previously `npx vitest run` / `npm run test` failed to bind with
  `EACCES ::1:63315` on this machine, forcing the `--environment=node`
  workaround below (hence the 60/3 figure and the `cookies.test.ts` /
  `auth-store.test.ts` / collection-error artifacts it produced — those
  needed `document.cookie` / `localStorage` / the real browser context and
  don't reflect a real failure). On 2026-08-27 the full suite just ran.
  Try the real command first; fall back to this only if it recurs:
  `npx vitest run --browser.enabled=false --environment=node <explicit file paths>`
  — note *paths*, not globs; bare positional args are substring filters and
  a glob matches nothing.
- **`localStorage` shadows the new seeds.** Clear keys `public-holidays`
  and `schedule-templates` before clicking through, or you'll see stale or
  empty data. (`official-holidays` was never persisted, so nothing to
  clear there.)
- Both new stores read `localStorage` at module scope, same as
  `policies-store.ts` — fine in a browser, throws under `--environment=node`.
