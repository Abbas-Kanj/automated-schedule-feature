# Handoff: employees / employees-list / official-holidays screens

Three screens pulled over from the sibling checkout
`../schedule-feature` (same GitHub owner, different repo, branch
`mahmoud-main`) on 2026-08-22.

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
| `official-holidays` | `/official-holidays` | Per-year holiday records, "Open year" seeding from `createPredefinedHolidays()`, add/edit/delete + bulk delete, faceted Rigid filter, URL-synced paging. |

## Flags — decide before building on these

- **No persistence, and no zustand.** All three keep state in React
  (`useState` + a context provider), unlike `schedules` / `shifts` /
  `shift-policies`, which persist to `localStorage` through a zustand
  store and re-validate against their zod schema on load. A holiday you
  add or a year you open is gone on reload, and the employee form's
  submit only calls `showSubmittedData` — there is no employees store at
  all. Converting them to the store pattern used elsewhere is the obvious
  next step if these are meant to be more than a UI demo.
- **Both tables hand-roll their markup instead of using the shared
  `components/data-table/data-table.tsx`.** That is deliberate for
  `official-holidays`: the shared `DataTable` has no row selection and no
  faceted filters, which that screen needs for bulk delete and the Rigid
  filter. `employees-list` could plausibly move onto the shared shell —
  it uses neither — but its columns have no `name` column, so the shared
  default `globalFilterFn` (a contains-match on `name`) would need a
  custom one passed in. Either extend the shared `DataTable` with
  selection + filters and move both over, or leave them; don't half-do it.

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
  `useTableUrlState` paging writes unvalidated search params. Works, but
  it's the odd one out next to `/official-holidays`.

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

1. **Click through all three screens.** Highest-risk unverified pieces, in
   order: the holiday action dialog's multi-date calendar popover (add /
   remove / uniqueness), "Open year" on a year that isn't the current one,
   and the `/employees-list` → `/employees?action=edit` round trip.
2. Decide on persistence (see the first flag above).
3. Decide whether `employees-list` moves onto the shared `DataTable`
   (see the second flag).
4. The Schedule and Position tabs on `/employees` are empty placeholders —
   they render literal `"Schedule"` / `"position"` text.
