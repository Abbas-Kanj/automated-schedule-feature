# Handoff: employees / employees-list screens

Three screens pulled over from the sibling checkout
`../schedule-feature` (same GitHub owner, different repo, branch
`mahmoud-main`) on 2026-08-22.

> **The `official-holidays` third of this file is superseded (2026-08-26).**
> That feature was deleted and replaced by `public-holidays`, ported from
> the same sibling repo's `mahmoud-branch`. Anything below about
> `official-holidays` is history, not current state — see
> `public-holidays-and-schedule-templates.md`. The `employees` /
> `employees-list` halves are still accurate.

## Where things stand

- **Ported and shipped `7e3450a`, pushed to `main`** — 29 files under `src/features/employees/`,
  `src/features/employees-list/`, `src/features/official-holidays/` plus
  three route files and two sidebar entries.
- `npm run build` clean, new code eslint- and prettier-clean, tests
  164 passed / 3 failed (only the pre-existing, unowned
  `search-provider.test.tsx` failures).
- **Nothing here has been opened in a real browser.**

## What each screen is

| Feature | Route | State |
|---|---|---|
| `employees` | `/employees` | Add/edit form, sidebar tabs Personal Info / Schedule / Position. Only Personal Info is built out — `position.tsx` and `schedule.tsx` are the source's one-line placeholders. |
| `employees-list` | `/employees-list` | Table over the 10 seeded records in `employees/data/data.json`. Row menu → `/employees?action=edit&employeeId=…`. |
| ~~`official-holidays`~~ | ~~`/official-holidays`~~ | **Deleted 2026-08-26**, replaced by `public-holidays`. |

## Flags — decide before building on these

- **No persistence, and no zustand** — now true of `employees` and
  `employees-list` only. Both keep state in React (`useState` + a context
  provider), unlike `schedules` / `shifts` / `shift-policies` /
  `public-holidays` / `schedule-templates`, which persist to
  `localStorage` through a zustand store and re-validate against their zod
  schema on load. The employee form's submit only calls
  `showSubmittedData` — there is no employees store at all. Converting
  them to the store pattern used everywhere else is the obvious next step
  if these are meant to be more than a UI demo.
  *(The holidays half of this flag was resolved on 2026-08-26 — the
  replacement screen has a store.)*
- **`employees-list` still hand-rolls its table markup instead of using
  the shared `components/data-table/data-table.tsx`.** The original
  reasoning here — that the shared `DataTable` had no row selection and no
  faceted filters — **no longer holds**: it gained `searchKey`, `filters`
  and a `bulkActions` render prop on 2026-08-26, and `public-holidays`
  now uses all three.
  **This is the "don't half-do it" case that flag warned about, and it is
  currently half-done:** the shared shell was extended and the holidays
  screen moved onto it, but `employees-list` was left behind (out of scope
  that session). Moving it over should now be straightforward — the one
  remaining wrinkle is unchanged: its columns have no `name` column, so
  the shared default `globalFilterFn` (a contains-match on `name`) needs a
  custom one passed in.

## Adaptations made while porting

The source copies do not typecheck under this repo's `tsc -b` (both repos
have byte-identical tsconfigs, so they don't typecheck in the sibling
either — that project is only ever run through `vite dev`, which skips
type checking).

- `/employees` got a real `validateSearch` (`action`, `employeeId`)
  instead of `useSearch({ strict: false })`, which typed those two props
  off the union of every other route's search schema and so didn't have
  them. The screen reads search through
  `getRouteApi('/_authenticated/employees')`.
- The edit-mode record is **derived from the URL** rather than mirrored
  into `useState` by an effect (the source set two pieces of state inside
  a `useEffect` keyed on `action` only). `employeeData.find(...)` returns
  a stable reference out of the imported JSON, so the remaining
  `form.reset` effect is safe to depend on it.
- `form: any` props on the three tab components typed as
  `UseFormReturn<Employee>`.
- The `organization_unit` cell reads `row.original` — `row.getValue()`
  returns `unknown`, so `.value` on it doesn't compile.
- Debug `console.log`s dropped; the no-op submit routed through
  `showSubmittedData`, matching every other form in this repo.

## Things that came over as-is, on purpose

- `employees-list/components/employees-list-provider.tsx` exports a
  `useEmployeesList` hook that returns the **context object** rather than
  `useContext(...)`'s value. It has no consumers today, so it's dead
  either way — fix it if something starts using it.
- The `organization_unit` column renders the option's `value`
  (`information_technology`), not its `label`. That's what the source
  does; it looks like a bug but it wasn't mine to decide.
- `employees-list`'s route has no `validateSearch`, so its
  `useTableUrlState` paging writes unvalidated search params. As of
  2026-08-26 it is also the **only** remaining caller of
  `useTableUrlState` — `/public-holidays` dropped URL-synced paging when
  it moved onto the shared `DataTable`. So either give this route a
  `validateSearch`, or move it onto the shared shell too and retire the
  hook.

## No dependency work was needed

The two repos' `package.json` dependency blocks are identical, and every
shared module these screens import — `components/data-table/*`,
`hooks/use-table-url-state`, `long-text`, `confirm-dialog`,
`select-dropdown`, `lib/show-submitted-data`, `hooks/use-dialog-state`,
`tanstack-table.d.ts` — is byte-identical between them. The one file that
differs, `select-dropdown.tsx`, differs because **this** repo's copy is a
superset (per-item `icon` and `disabled`), so the ported call sites work
unchanged.

## Pick up here

1. **Click through both remaining screens.** Highest-risk unverified
   piece: the `/employees-list` → `/employees?action=edit` round trip.
   *(The holiday-dialog items that used to head this list moved to
   `public-holidays-and-schedule-templates.md`.)*
2. Decide on persistence for `employees` / `employees-list` (see the first
   flag above).
3. Move `employees-list` onto the shared `DataTable` — the blocker is gone
   (see the second flag).
4. The Schedule and Position tabs on `/employees` are empty placeholders —
   they render literal `"Schedule"` / `"position"` text.
