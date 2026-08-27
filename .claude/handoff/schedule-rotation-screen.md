# Schedule Rotation screen

Screen at `/schedule-rotation` showing a rotate schedule's shift rotation across
its employees, weekly or monthly — the "Weekly Shift Rotation" mock the user
supplied.

> **Renamed 2026-08-26**: the screen was called **Shift Rotation** through
> 2026-08-25. It is now **Schedule Rotation** everywhere user-visible (page
> `<h2>`, both sidebar entries) and in the code comments that refer to it by
> name. The route, feature directory and file names were already
> `schedule-rotation`, so the rename made them consistent rather than
> introducing a new name. This handoff file was `shift-rotation-screen.md`
> before the rename.

## What it does

- **Schedule dropdown** — lists **rotate schedules only** (`parent_type ==
  'regular' && type == 'rotate'`), the only kind carrying a shift `pattern`.
- **Weekly / Monthly** toggle (shadcn `Tabs` used as a segmented control — no
  `TabsContent`, intentional).
- **Date navigator** — prev / range label / next / **Reset**. Reset returns to
  the schedule's `start_date` period (which is rotation period 0).
- **Cycle legend** — decodes the sequence letters (`M = Morning`, …, `O = Off`).
- **Table** — Employee Name · Current Schedule Sequence · Assigned Shift This
  Week/Month. The sequence is the cycle rotated so the employee's current
  position is first and emphasized (Alice `M A N O`, Bob `A N O M`).

## Model (per the user's answers)

- **Employees are auto-derived from the shifts**, not stored on the schedule.
  Each shift's **Assign to** tab now has real **Employees** + **Teams** pickers
  (was only the freeform "Work type group"). The roster = union of every
  employee assigned to a pattern shift (teams resolved to members, deduped).
- **Stagger by starting shift**: an employee's `offset` is the first cycle
  position whose shift they're on. So Morning-assigned people start on Morning,
  Afternoon-assigned start on Afternoon, etc. **Corollary**: two pattern
  positions holding the *same* shift produce only *one* offset — a 7-position
  block pattern built from 2 shifts runs as **2 crews, not 7** (see Production
  Line Rotation below).
- **One step per period**: `assignedIndex = (offset + periodIndex) mod
  cycleLength`. `periodIndex` = whole weeks/months between the viewed period and
  the `start_date` period. Off positions have no starters but everyone rotates
  through them. The Weekly/Monthly toggle only changes *what one step means* —
  it is independent of `cycle_length`.

Core logic is pure in `src/features/schedule-rotation/utils.ts`
(`buildRotation`, `getRotationPositions`, `getRotationRoster`, `getAssignedIndex`,
period helpers), unit-tested in `utils.test.ts`.

## Files

- `src/features/schedule-rotation/` — `utils.ts`, `utils.test.ts`, `data.ts`
  (period options + soft badge color map), `index.tsx`, `components/`
  (`schedule-rotation-table.tsx`, `shift-badge.tsx`).
- `src/routes/_authenticated/schedule-rotation/index.tsx` (+ regenerated
  `routeTree.gen.ts`).
- `src/components/layout/data/sidebar-data.ts` — **two** entries point at this
  route: a top-level **Schedule Rotation** button (`RotateCw` icon, sits between
  Time Track and Employee Management) added 2026-08-26, plus the original
  **Time Track → Schedules → Schedule rotation** leaf. The duplication is
  deliberate-for-now, not an oversight — see Open calls.
- **Shift schema change**: `shifts/data/schema.ts` added
  `employee_ids: string[]` + `team_ids: string[]` (both `.default([])`).
  Threaded through `defaults.ts`, `normalizeShiftFormValues` (cleared when
  Assign-to is off), `assign-to-tab.tsx`, and the `makeShift` fixture in
  `schedules/utils.test.ts`.

## Seed data — four rotations, four different shapes

Expanded 2026-08-26 from one rotation to four, deliberately covering different
cases of the rotate model. All in `schedules/data/schedules.ts` +
`shifts/data/shifts.ts`.

| Schedule | Cycle | Case it covers |
|---|---|---|
| Store Floor Rotation | 4 days — `M A N O` | One shift per position, 3 shifts + off |
| Production Line Rotation | 7 days — `D D D N N O O` | **Block pattern** (a shift holds consecutive positions) → 2 crews from 2 shifts; `cycle_length.unit: 'weekly'` |
| Support Desk Rotation | 9 cards — `E E E L L L N N O` | **`custom_shifts`** ("Custom alternate") driven by `shift_repeat` intervals; also `temporary_schedule` + `end_type: 'on_date'` |
| On-Call Duty Rotation | 4 months — `P B E O` | Built for the **Monthly** tab (one tier per calendar month); `end_type: 'after_occurrences'` |

Supporting shifts added to `shifts.ts` (8 new, all `shift_type: 'rotate'`):

- **Day Line / Night Line** — 12h, exercise `full_day_hours`/`half_day_hours`.
  Night Line uses `seed-team-engineering` + one individual.
- **Early / Late / Night Desk** — 24×5. Added a local `weekdaysOnly()` helper in
  `shifts.ts` (Mon–Fri variant of `buildDefaultDays`) so Sat/Sun are disabled.
- **Primary / Backup / Escalation On-Call** — `category: 'oncall'`,
  `time_slot_type: 'overtime'`.

Design constraints that shaped these (worth knowing before editing them):

- **Cycle letters must be unique per rotation.** The sequence chip is
  `shift.name[0].toUpperCase()`, so two shifts in the same pattern starting with
  the same letter collide. That's why the line shifts are "Day Line"/"Night Line"
  and not "Plant Day"/"Plant Night".
- **`custom_shifts` pattern length must equal the sum of `shift_repeat`
  intervals**, and no shift may be assigned more cards than its own interval.
  Support Desk uses 3+3+3 = 9 cards but assigns Night only 2, leaving the ninth
  card free as the rest day.
- All 10 seeded employees land in ≥1 rotation; 2 of the 4 resolve members
  through a team rather than direct ids.

## Status

- **Committed and pushed to `main`** on 2026-08-27, as `7ae79da` (the
  screen + seed data) — part of a 9-commit session that also organized and
  shipped every other feature that had piled up uncommitted (teams,
  employees refactor, shifts assign-to, shift-policies holiday-work rule,
  public-holidays, schedule-templates). No code changed in that session,
  only commit organization.
- `npm run build` **clean**.
- Seed data **validated against the real schemas**: every record parses
  `z.array(shiftSchema)` / `z.array(scheduleSchema)`, and `buildRotation` was run
  across consecutive periods for all four schedules to confirm the sequences
  advance correctly (on-call crews step Primary → Backup → Escalation → Off month
  by month; line crews' block walks forward one position per week). This was done
  with a **throwaway test file that was deleted afterwards** — see Open calls,
  it's arguably worth making permanent.
- **Full suite now runs clean on this machine**: `npm run test` (real
  browser mode, no workaround needed) — 174 passed / 3 failed, the 3 being
  the pre-existing unowned `search-provider.test.tsx` failures. The vitest
  EACCES port-bind issue described below did **not** reproduce on
  2026-08-27 — see that section, left in place as a workaround in case it
  comes back rather than deleted outright.
- **Still NOT browser-verified.** No browser tooling connected in the
  08-25, 08-26, or 08-27 sessions.

## ⚠️ Environment gotchas hit in earlier sessions

### Vitest browser mode fails on this machine — did NOT reproduce 2026-08-27

`npx vitest run` / `npm run test` ran clean in real browser mode on
2026-08-27 (174 passed / 3 failed, see Status). Whatever was holding the
port in the 08-25/08-26 sessions wasn't happening this time — treat the
workaround below as a fallback to reach for if the error comes back, not
as the current state of this machine.

Previously, `npx vitest run` died before any test with:

```
Error: listen EACCES: permission denied ::1:63315
```

That's the browser-mode server failing to bind (a Windows excluded-port-range
problem, **not** the Claude sandbox — it reproduces with the sandbox disabled).
Workaround for non-DOM test files only:

```
npx vitest run --browser.enabled=false --environment=node <files>
```

Add `--disableConsoleIntercept` if you want `console.log` output through. This
does **not** work for `.tsx` tests that need a DOM, so the full suite (and the
174/3 figure the previous session recorded) could not be reproduced here.

### localStorage shadows the new seed

`shifts` and `schedules` stores persist to `localStorage` and re-use the cached
copy over the seed (the footgun CLAUDE.md already calls out). A browser that has
run this app before **won't** see the three new rotations or the eight new
shifts. To see them:

```js
localStorage.removeItem('schedules'); localStorage.removeItem('shifts'); location.reload()
```

`teams` and `employees` seeds are unchanged, so they don't need clearing.

## Open calls / follow-ups

1. **Two sidebar entries point at `/schedule-rotation`** (top-level button +
   the Time Track → Schedules leaf). Kept both because the Time Track hierarchy
   is the user's own recent deliberate work — decide whether to drop the nested
   leaf.
2. **Latent display bug in `pattern-builder.tsx` (~line 266)**: the week-count
   readout divides `cycle_length.days` by a hardcoded `6`, but
   `CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS.weekly` is **7** — which is what actually
   gets written into `days` when the unit is picked. A 7-day weekly cycle
   currently renders as `round(7/6)` = "1 week", correct by luck. Seeds were
   matched to the constant (7), not the display. **Not fixed** — out of scope
   when found.
3. **The seed-validation check is worth keeping as a real test.** The stores
   silently fall back to the seed when a persisted blob fails to parse, so an
   invalid seed is easy to ship unnoticed. Nothing in the suite currently parses
   `defaultShifts`/`defaultSchedules`.
4. **`src/features/schedule-rotation/index.tsx` fails `prettier --check`** —
   pre-existing repo-wide Tailwind class-sorting drift (`text-muted-foreground`
   ordering, 4 spots), untouched deliberately so the rename diff stays clean.
   Part of the still-open repo-wide Prettier normalization call in CLAUDE.md.
5. **`eslint` still reports 11 errors / 3 warnings**, same 5 files, unchanged
   as of 2026-08-27 — re-checked during the commit-organizing session and the
   count/locations are identical. None are in files any session touched for
   this feature. Still worth a look before anyone treats lint as a gate, but
   confirmed stable rather than actively drifting.
