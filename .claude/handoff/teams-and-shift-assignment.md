# Handoff: Team Management + shift Assign-to employees/teams

Two features that were **fully built before this file existed** — no prior
session state or handoff file mentions either. They were sitting
uncommitted in the working tree alongside the 2026-08-26 batches, surfaced
and committed on 2026-08-27 while picking that pile up. Nothing below was
written this session; this file just records what's actually there.

## What each feature is

### Team Management (`src/features/teams/`, route `/teams`)

A team is `{ id, name, description?, employee_ids: string[] }` —
`employee_ids` references the employee directory
(`features/employees/stores/employees-store.ts`) by id. Standard
CRUD-record pattern, matching `shifts`/`shift-policies`/`public-holidays`:
zustand store persisted to `localStorage` (key `teams`), re-validated
against `teamSchema` on load with a seed fallback on parse failure. Table +
create/edit `TeamFormDialog` (name, description, a `MultiSelect` of
employees) + delete via `ConfirmDialog`. Seeded with two teams
(`seed-team-engineering`, `seed-team-operations`), members picked by index
from the bundled employee sample.

Sidebar: **Team Management**, top-level nav item (`UsersRound` icon).

### Shift Assign-to employees/teams (`shifts/components/shift-form/assign-to-tab.tsx`)

The shift form's Assign-to tab previously had three freeform,
no-downstream-effect dropdowns (Work type group, Service resource, Service
territory — placeholder option lists, no real data behind any of them).
Now:

- **Work type group** is a single-select of assignment *modes* (Team /
  Employee / Group / By branch) instead of a multi-select of job types.
  Still freeform — picking a mode doesn't cascade into anything.
- **Service resource / Service territory are gone**, replaced by real
  **Employees** and **Teams** multi-selects, sourced from
  `useEmployeesStore` / `useTeamsStore`.
- New `employee_ids: string[]` / `team_ids: string[]` on `shiftFieldsSchema`
  (both `.default([])`), threaded through `defaults.ts` and
  `normalizeShiftFormValues` (cleared to `[]` when Assign-to is toggled
  off).

> ### ⚠️ Two corrections — this section described the tab as load-bearing
>
> **These fields drive nothing.** The claim that the Schedule Rotation screen
> reads them to derive a rotation's roster was true only until **2026-08-29**,
> when the roster moved onto the schedule's own `day_coverage` matrix.
> `schedule-rotation/scenario.test.ts` pins it: strip every shift's
> `employee_ids`/`team_ids` and the roster is unchanged. They are sample data
> saying who *may* work a shift.
>
> **And the tab is no longer rendered.** As of **2026-09-12** the shift form
> offers General / Shift times / Shift policy only — the Repeat and Assign-to
> triggers were removed from `shift-form-tabs.tsx`, and Shift times lost its
> **Start date** field too.
>
> Nothing was deleted: `assign-to-tab.tsx`, `repeat-tab.tsx` and every schema
> field stay. That is safe because each field is optional or defaulted, the
> repeat refine block is gated behind `repeat_enabled` (false by default and in
> all 8 seeds), `assign_to_enabled` gates no validation at all, and
> `start_date` appears in no refine. **`normalizeShiftFormValues` only blanks a
> field when its own toggle reads false**, and nothing changes a toggle now, so
> editing a shift that already carries these values keeps them —
> **do not force either toggle to `false` in `defaultValues`**, which would
> destroy stored data on every save.
>
> **Known edge, unfixed:** a shift persisted in `localStorage` with
> `repeat_enabled: true` and a partly-filled `repeat` would now fail validation
> with **no reachable UI and no visible error** — the form would just refuse to
> submit. No seed is in that state, so it was left alone rather than fixed
> speculatively. If a shift mysteriously won't save, look here first.

## Dependency order (why this mattered for committing)

Team Management depends on the employees store/utils
(`useEmployeesStore`, `getEmployeeFullName`) added in the 2026-08-27
employees-form-and-list rework (`e99abb4`) — `team-form-dialog.tsx`'s
member picker imports both directly. The shift Assign-to change depends on
*both* teams and employees stores. So the commit order that actually
typechecks at each step is: employees rework → teams → shifts assign-to →
(from there) Schedule Rotation, which needs all three. This is recorded
here because it wasn't obvious from the working tree alone — it took
reading the actual imports to recover.

## Status

- **Committed and pushed to `main`, 2026-08-27**: `d808701` (teams),
  `c8c333c` + `ca6ad08` (shifts assign-to — the second is a small
  work-type-group options file that got missed in the first pass and
  landed as its own small commit rather than rewriting history).
- `npm run build` clean.
- Full suite **174 passed / 3 failed** (the 3 are the pre-existing unowned
  `search-provider.test.tsx` failures, unrelated).
- **Not browser-verified**, at all. Nobody has clicked: add/edit/delete a
  team, the member multi-select, or the shift form's new Employees/Teams
  pickers. Given these feed Schedule Rotation's roster, a bug here would
  surface there first and be non-obvious to trace back.

## Open questions / not decided

1. **No route guard or empty state was checked** for `/teams` with zero
   teams — worth a look since `defaultTeams` always seeds two, so an empty
   table has never actually rendered.
2. **`work_type_group`'s options (Team/Employee/Group/By branch) still
   drive no behavior** — selecting "Team" doesn't filter or require the
   Teams picker, "Employee" doesn't require the Employees picker. If that
   cascade is wanted, it isn't built.
3. Whether a team should be deletable while a shift still references its id
   in `team_ids` was not addressed — nothing currently checks for that
   reference before deleting a team (same class of gap as deleting an
   employee referenced by `employee_ids` on a shift or another team).
