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

- **Ported and shipped `7e3450a`, pushed to `main`** (2026-08-22) — 29
  files under `src/features/employees/`, `src/features/employees-list/`,
  `src/features/official-holidays/` plus three route files and two
  sidebar entries.
- **Reworked and shipped `e99abb4`, pushed to `main`** (2026-08-27): the
  employee form dropped its sidebar-tabbed Personal Info / Schedule /
  Position layout for one flat form (`employee-fields.tsx` +
  `employee-select-field.tsx`), and `employees-list` moved onto the
  shared `DataTable` — see the flags below, both now resolved.
- `npm run build` clean; full suite **174 passed / 3 failed** (only the
  pre-existing, unowned `search-provider.test.tsx` failures).
- **Nothing here has been opened in a real browser.**

## What each screen is

| Feature | Route | State |
|---|---|---|
| `employees` | `/employees` | Add/edit form — flat, Personal Info fields only (no more sidebar tabs; Schedule/Position were always the source's one-line placeholders and are gone, not just hidden). |
| `employees-list` | `/employees-list` | Renders through the shared `DataTable` (see below), reading from `useEmployeesStore` — same 10 seeded records, now via a store instead of the raw JSON import. Row menu → `/employees?action=edit&employeeId=…`. |
| ~~`official-holidays`~~ | ~~`/official-holidays`~~ | **Deleted 2026-08-26**, replaced by `public-holidays`. |

## Flags

- **No persistence for creates/edits, still true.** `employees/stores/employees-store.ts`
  (added 2026-08-27) is read-only — seeded from `data.json`, no
  `addEmployee`/`updateEmployee` actions — deliberately, per its own
  comment, since these are seed-only records today and caching a mutated
  copy to `localStorage` would just shadow the seed (the footgun CLAUDE.md
  calls out elsewhere). The employee form's submit still only calls
  `showSubmittedData`. Wiring real add/update actions onto the store is
  the obvious next step if this is meant to be more than a UI demo.
- ~~`employees-list` hand-rolls its table markup~~ **Resolved 2026-08-27**
  — `employees-list` now renders through the shared `DataTable`
  (`employees-table.tsx`), same as `public-holidays`, with a custom
  `globalFilterFn` since its columns have no single `name` column.

## Adaptations made while porting

The source copies do not typecheck under this repo's `tsc -b` (both repos
have byte-identical tsconfigs, so they don't typecheck in the sibling
either — that project is only ever run through `vite dev`, which skips
type checking).

> The three-tab layout (`form: any` props, one component per tab)
> mentioned below is **gone as of 2026-08-27** — `/employees` is now a
> single flat form. Kept as history of the original port, not a pointer
> to current files.

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
- Debug `console.log`s dropped; the no-op submit routed through
  `showSubmittedData`, matching every other form in this repo.

## Things that came over as-is, on purpose

Both items below were **resolved 2026-08-27** as part of the
`employees-list` DataTable migration:

- ~~`employees-list/components/employees-list-provider.tsx` exports a
  `useEmployeesList` hook that returns the context object rather than
  `useContext(...)`'s value~~ — the whole file is deleted; `employees-list`
  no longer uses a context provider at all.
- ~~The `organization_unit` column renders the option's `value`
  (`information_technology`), not its `label`~~ — the rebuilt
  `employeesColumns` renders `.label` in a `Badge`, matching every other
  column that shows one of these value/label objects.
- `employees-list`'s route still has no `validateSearch`, but this is now
  moot rather than an open question: the shared `DataTable` keeps
  filter/pagination state locally (not URL-synced), so `employees-list`
  dropped `useTableUrlState` entirely when it moved onto it — same
  resolution `public-holidays` took. `hooks/use-table-url-state` is now
  only used by `users`/`tasks`, the template's demo boilerplate modules
  (not one of the three real feature modules) — leave the hook in place
  for them, nothing left to retire it for.

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
2. Decide on persistence for `employees` / `employees-list` (see the flag
   above) — now specifically means wiring `addEmployee`/`updateEmployee`
   actions onto `useEmployeesStore`, since the store itself now exists.
3. **The flat employee form only collects Personal Info** — `position` and
   `organization_unit` are still required fields on `EmployeeSchema` (used
   elsewhere: `employees-list`'s Position/Organization unit columns, and
   `features/teams`' member picker shows a name only, not these), but
   nothing in `EmployeeFields` lets you set them. Decide whether they need
   inputs, get defaulted some other way, or should drop off the schema.
