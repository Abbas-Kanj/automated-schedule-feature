# Schedule Rotation screen

Screen at `/schedule-rotation` showing a rotate schedule's shift rotation across
its crew, weekly or monthly — the "Weekly Shift Rotation" mock the user
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
- **Daily / Weekly / Monthly** toggle (shadcn `Tabs` used as a segmented control
  — no `TabsContent`, intentional). **Daily added 2026-09-02**; it is disabled
  when one pattern card is not one real calendar day (see the Model section).
- **Date navigator** — prev / range label / next / **Reset**. Reset returns to
  the schedule's `start_date` period (which is rotation period 0).
- **Cycle legend** — decodes the sequence letters (`M = Morning`, …, `O = Off`).
- **Table** — Employee Name · Current Schedule Sequence · Assigned Shift This
  Week/Month. The sequence is the cycle rotated so the employee's current
  position is first and emphasized (Amir `M A N O`, Bilal `A N O M`).

## Model

> **Reworked 2026-08-29.** The roster used to be *inferred* from the shifts.
> It is now *declared* on the schedule. See "The 2026-08-29 rework" below for
> what changed and why; everything in this section describes the current
> behaviour.
>
> **Extended 2026-09-02** with a `daily` step and per-crew fixed shifts, then
> **reworked again 2026-09-06**: the roster moved off the pattern onto its own
> stored matrix. Both are noted inline below; the full account is in
> `.claude/handoff/rotation-suggestion.md`.
>
> **Relocated 2026-09-11**: producing the matrix (the "Assign to" step) moved
> *out* of the schedule wizard entirely, onto a new page owned by **this**
> feature — `/schedule-rotation/assign`
> (`schedule-rotation/pages/assign/schedule-rotation-assign-page.tsx`). See
> "The 2026-09-11 relocation" below. This screen's own read-only display
> (everything above "## Model") is unaffected — it still only ever reads
> `day_coverage`.

- **The crew is stored on the schedule as a matrix.** `schedule.day_coverage`
  is a sparse list of `{ day, shift_id, employee_ids, team_ids }` cells — a
  (cycle day × shift) → crews grid — set via the **"Assign crews"** flow at
  `/schedule-rotation/assign` (moved off the schedule wizard 2026-09-11; see
  below). `getRotationRoster` reads that and **nothing else**.
  **Superseded 2026-09-06:** it used to read `pattern[].employee_ids` /
  `team_ids`, treating a crew's card index as its offset. Those fields are
  **gone from the schema**, along with `crew_shift_id` — one offset cannot name
  two shifts, so that model could not express "cover every selected shift every
  day", which is now the rule. See the companion file's "The model".
- **The pattern is a template, not the roster.** It describes one crew's
  journey ("Morning, Morning, off, Afternoon"); `getRotationPositions` still
  resolves it for the letters/labels/colours of the reference row, but who
  works what comes from the matrix.
- **One step per period**: `assignedIndex = periodIndex mod cycleLength` — the
  same cycle day for everyone now, since people differ by what the matrix gives
  them rather than by an offset into a shared pattern. `periodIndex` is whole
  days/weeks/months between the viewed period and the `start_date` period. The
  Daily/Weekly/Monthly toggle only changes *what one step means*; it is
  independent of `cycle_length`.
  `RotationRow.offset` survives as **the first cycle day that employee works**,
  a sort key and nothing more.
- **`daily` is what a day-based pattern needs** (2-2-3, 4-on-4-off, DuPont):
  one card advances one calendar day. Read through the weekly step the same
  cards would describe a cycle seven times longer. It is **disabled** when
  `getScheduleCycleLength(schedule) !== pattern.length` — the
  weekly-`shift_repeat`-card case in open call #4 below, where one card really
  does span a week.
- **`cycleLength === pattern.length`**, regardless of `cycle_type`. This
  screen never reads `cycle_length.days` or `shift_repeat`.
- **Shifts keep their own "Assign to" tab**, and their `employee_ids` /
  `team_ids` are kept as sample data. They say who *may* work a shift; they no
  longer decide who holds which slot of a rotation.
- A crew hand-placed on **two shifts the same day** renders as the first one
  here rather than flickering; the form warns about it in place
  (`crew-double-booked`).

Core logic is pure in `src/features/schedule-rotation/utils.ts`
(`buildRotation`, `getRotationPositions`, `getRotationRoster`,
`getAssignedIndex`, period helpers), unit-tested in `utils.test.ts` and locked
against the real seeds in `scenario.test.ts`. `applyCrewShift` was **deleted**
2026-09-06 with `crew_shift_id`.

Producing the matrix in the first place lives elsewhere and is pure too —
`src/features/schedules/rotation-suggestion.ts`, driven from the "Assign
to" UI (`schedule-assign-to-fields.tsx`), which since 2026-09-11 is mounted
on `/schedule-rotation/assign` rather than the schedule wizard — see below.
This screen only ever *reads* the result.

## The 2026-09-11 relocation — "Assign to" moved into this feature

**Why.** Crew assignment used to be wizard step 4 of 6, wedged between
Pattern and Start & End — meaning a rotate schedule had to be staffed
*during creation*, before it even existed as a saved record, and the
heaviest, most interactive step in an otherwise light wizard sat in the
middle of it. `day_coverage`/`crew_placements` are just fields on the
`Schedule` record (optional, default `[]`, coverage gaps are warnings not
schema errors), and this feature already existed purely to *display* that
roster — so the natural home for *doing* the assignment is here too, on its
own schedule, independent of creation.

**What changed.**

- The wizard (`schedules/components/schedule-form/schedule-form.tsx`) lost
  the `assign-to` step entirely. Rotate's step list is now `basics → shifts
  → pattern → end-settings → summary` (5 steps, was 6). Its `assignToCommitRef`
  plumbing and the `getStepFields('assign-to')` branch went with it.
- New page: `schedule-rotation/pages/assign/schedule-rotation-assign-page.tsx`,
  routed at `/schedule-rotation/assign` (optional `?scheduleId=` search
  param to deep-link past the picker). Two parts: a `Select` over **every**
  rotate schedule (assigned or not — same screen serves first-time
  assignment and re-edit), each option labelled with a crew-count status
  (`crewKeysFromDayCoverage`); then, once picked, a small local `useForm`
  (no `zodResolver` — the fields it touches are optional/warning-only at
  the schema level, so there's nothing to validate) seeded from that
  schedule's `pattern`/`shift_ids`/`start_date`/`end_settings`/
  `day_coverage`/`crew_placements`, mounting **`ScheduleAssignToFields`
  unchanged** plus (**new**) `ScheduleStartEndFields` unchanged, under one
  "Save assignment" button. Save calls `commitRef` (same ordering the
  wizard's "Next" used), then `updateSchedule(schedule.id, { ...schedule,
  pattern, day_coverage, crew_placements, start_date, end_settings })`.
- **Entry point**: an "Assign crews" button next to this screen's own
  schedule `Select`, deep-linking to the schedule currently selected here.
  The "No employees on this rotation" empty-state copy was updated to
  point at it instead of the old wizard step.
- **Wizard Summary + View page**: both used to show the full coverage
  panel for a rotate schedule; both now show a one-line status note
  ("Not yet assigned…" / "N crews assigned…") via a new shared
  `assign-to-status-note.tsx`, pointing at Schedule Rotation for the real
  UI. The View page needed its own small carve-out for this — it renders
  every wizard section at once via a `disabled ||` pattern, and
  `ScheduleSummary` (which carries the note) doesn't render in disabled
  mode at all, so the note is rendered directly in `schedule-form.tsx`
  too, gated on `disabled` alone.
- **Tests**: `schedule-form.test.tsx` (nothing but the wizard-seam
  rotate-assignment suite) was deleted outright. Its 3 seam tests moved to
  a new colocated `schedule-rotation-assign-page.test.tsx`, driving "Save"
  instead of "Next" against an `AssignToPanel` component exported for
  testing, with `useSchedulesStore`/`useNavigate`/`sonner` mocked rather
  than hitting the real store. Its 4th test was already redundant with
  `scenario.test.ts`'s general "every seeded cycle" loop and wasn't
  re-added. Two more tests added for the new Start & End fields
  (round-trips unedited; saves an edited end frequency).
- **No schema or data migration.** `day_coverage`/`crew_placements` already
  defaulted to `[]`; a schedule created via the now-5-step wizard just
  starts unassigned until visited via the new page. `SEED_VERSION` not
  bumped — nothing about stored shape changed.
- **New `optimizeDeps.include` entry**: `react-day-picker`, discovered
  mid-run by the new page's test mounting `ScheduleStartEndFields`'s date
  picker for the first time — same class of issue as the `@radix-ui/*`
  entries already there (see the gotcha section below).

**Not done / still open:** no browser verification (see Status below);
`/schedule-rotation`'s own `Select` and this new page's `Select` are two
separate, un-synced pieces of state — picking a schedule on one doesn't
carry over to the other except via the explicit `?scheduleId=` deep-link
on the "Assign crews" button. Full click-path in the companion file's
Status/Open-calls sections.

## The 2026-08-29 rework — assignment moved onto the schedule

**The problem.** `getRotationRoster` used to merge each position's *shift*
assignments and give each person the index of the first position they appeared
on. That only worked while every shift happened to carry exactly one person:

- A shift pointing at a **team** dropped every member onto the same position —
  four people all on Morning, nobody anywhere else.
- An **off position has no shift**, so it could not name anyone. A
  `pattern[].employee_ids` field had been bolted on as a special case just for
  the rest slot.

So the cycle had to be guessed out of data that was never meant to answer "who
starts where".

**The change.**

- New **"Assign to" step** in the schedule form, rotate only, sitting between
  **Pattern** and **Start & End** (**as of 2026-09-12 rotate has no "Start &
  End" step at all** — it moved to the Schedule Rotation screen, so "Assign
  to" now sits between **Pattern** and **Summary**) —
  `schedule-form/schedule-assign-to-fields.tsx`. One row per cycle position,
  each with Employees + Teams multi-selects, built from the same `MultiSelect`
  the shift form's own Assign-to tab uses.
  **Superseded 2026-09-11**: that step no longer exists in the wizard at
  all — the same component moved onto this feature's own
  `/schedule-rotation/assign` page. See "The 2026-09-11 relocation" above.
- `getRotationRoster` now reads the schedule, not the shifts. **No schema
  restriction was added** — an unassigned position stays valid and the step
  never blocks "Next", a call that still holds today.
- `pattern-builder.tsx`'s `custom_shifts` rebuild carried crew across by
  position, so stepping back to Pattern and changing an interval did not empty
  the roster.

> **Superseded 2026-09-06.** The crew fields left the pattern entirely for
> `day_coverage`, so the carry-across logic (`crewAt`) and the crew keys in the
> drag-reorder payload were all deleted — a card is only a shift or a rest day
> now, and reordering one cannot disturb the roster. The 2026-08-29 *direction*
> (declare the roster on the schedule, do not infer it from shifts) stands; only
> its storage shape changed.
- The Summary step gained an "Assign to" section; the rotation screen's
  "no employees" empty state now points at the schedule's step rather than the
  shift's tab.

**Deliberately not done:** the step is rotate-only (fixed/flexible have no
pattern to attach crew to, and a schedule-wide roster field would need a schema
change with no consumer), and there is no `assign_to_enabled` toggle at
schedule level.

## Seed data — three scenarios

Rewritten 2026-08-29, third added 2026-09-02, **all three re-expressed as
`day_coverage` matrices 2026-09-06**. The first two are the same shape at
different sizes: **one cycle position per shift plus a rest slot, and one crew
per position**, so every crew covers every shift and exactly one is off at a
time. The third is deliberately a different animal — a pure rest mask read
daily, with crews spread across shifts.

| Schedule | Crew | Cycle | Pattern type | Read on |
|---|---|---|---|---|
| **Shift Rotation** | Team A — Amir, Bilal, Carla, Dana | 4 — `M A N O` | Rotate pattern (`pattern_shifts`) | Weekly |
| **Desk Alternation** | Team B — Elias, Farah, Ghassan | 3 — `E L O` | Custom alternate (`custom_shifts`) | Weekly |
| **Plant Coverage (2-2-3)** | Amir, Bilal, Carla, Dana as four one-person crews | 14-day 2-2-3 mask | Rotate pattern (`pattern_shifts`) | **Daily** |

Plant Coverage is the fixed-shift case, and since 2026-09-06 it is also the
clearest demonstration of the whole model: **every working card of its pattern
names Morning, and Night is staffed on all fourteen days.** Amir and Carla hold
mornings, Bilal and Dana nights, interleaved (the crews pair up differently day
to day — a 4-cycle) so no day loses cover. It used to need four hand-set
`crew_shift_id` pins; the suggestion now produces it unaided.

`scenario.test.ts` locks every seeded cycle's matrix against the rule — "staffs
every selected shift on every day of every seeded cycle" — which is what
verified the hand-computed cells.

Supporting data:

- **7 employees** in `employees/data/data.json` (`emp-a`…`emp-g`).
- **2 teams** in `teams/data/teams.ts` — `team-a` (4), `team-b` (3). Teams group
  people and populate the step's Teams picker; they do not themselves decide
  who works when.
- **5 shifts** in `shifts/data/shifts.ts` — Morning 06:00–14:00, Afternoon
  14:00–22:00, Night 22:00–06:00 (`overnight`), Early 07:00–15:00, Late
  15:00–23:00.

Design constraints that shaped these (worth knowing before editing them):

- **Cycle letters must be unique per rotation.** The sequence chip is
  `shift.name[0].toUpperCase()`, so two shifts in the same pattern starting with
  the same letter collide. That's why the desk shifts are "Early"/"Late".
- **`custom_shifts` pattern length equals the sum of `shift_repeat`
  intervals**, and no shift may hold *more* cards than its own interval —
  fewer is fine. Desk Alternation needs 3 cards from 2 shifts, so Early carries
  an interval of 2 while the pattern spends one, leaving card 3 free as the rest
  slot. Change an interval and the card count changes with it.
- **Crew count should equal position count.** Fewer and a position starts
  empty; more and the extras never enter the cycle. Nothing enforces this — it
  is asserted in `scenario.test.ts`, not in the schema.

## Status

> **2026-09-11 supersedes every number below.** Build/test/lint numbers
> aside, the substantive change is the relocation described above — read
> that section first.
>
> - `npm run build` **clean**. `npx eslint .` — same pre-existing baseline
>   (11 errors / 3 warnings, none in files this touched).
> - `npm run test` — **273 passed / 3 failed**, still only the pre-existing
>   unowned `search-provider.test.tsx` three.
> - **Still not browser-verified by hand** — this session had no browser
>   tooling either. The click-path to verify is in
>   `.claude/handoff/rotation-suggestion.md`'s Open calls #1, updated for
>   the new location.
>
> *(The 2026-09-06 line this replaces read 243 passed / 3 failed.)*

> **2026-09-06 supersedes every number below**: `npm run build` clean;
> `npm run test` **243 passed / 3 failed** (same three unowned
> `search-provider.test.tsx` failures); `npx eslint` **0 errors**, 3 warnings,
> all pre-existing. `utils.test.ts` and `scenario.test.ts` were rewritten onto
> `day_coverage` and now also assert every seeded cycle staffs every selected
> shift on every day. Still **not browser-verified**, and **uncommitted** —
> three sessions' worth (09-02, 09-03, 09-06).
>
> *(The 2026-09-02 line this replaces read 221 passed / 3 failed.)*

### As of 2026-08-29

- `npm run build` **clean**.
- `npm run test` — **192 passed / 3 failed**, the 3 being the pre-existing
  unowned `search-provider.test.tsx` failures.
- `npx eslint` on every touched file — **0 errors**; 3 warnings, all
  pre-existing (two `exhaustive-deps` in `pattern-builder.tsx`, one
  `incompatible-library` in `schedule-form.tsx`).
- **Automated coverage of the new step**: `schedule-assign-to-fields.test.tsx`
  renders it in real Chromium — one row per position including Off, seeded crew
  resolved to full names, and a typed pick on the **off** position landing in
  the roster. *(Rewritten 2026-09-06 for the day × shift grid: one picker per
  selected shift per day, a free cell edit disturbing nothing else, and a cell
  dropped once its last crew is removed.)*
- `scenario.test.ts` locks both rotations week by week, and asserts the roster
  is unchanged when every shift's `employee_ids`/`team_ids` are stripped —
  i.e. proves the schedule is the only source.
- **Still NOT browser-verified by hand.** No browser tooling was connected in
  the 08-25 → 08-29 sessions. The component test covers the new step's
  mechanics but not the wizard flow around it (stepping Pattern → Assign to →
  Start & End, or the read-only view).
- Prettier: the files this session created or rewrote are clean.
  `schedule-form.tsx`, `pattern-builder.tsx` and `schedule-rotation/index.tsx`
  still fail `prettier --check`, but **already failed at HEAD** — that's the
  repo-wide drift CLAUDE.md tracks as an open call, left alone deliberately so
  this diff stays readable.

## ⚠️ Environment gotchas

### `react-select` needs `resolve.dedupe` under vitest browser mode

Added to `vite.config.ts` this session:

```ts
resolve: {
  dedupe: ['react', 'react-dom'],
  alias: { ... },
}
```

Without it, `react-select` resolves a second React instance inside vitest's
optimized deps and every `MultiSelect` throws
`Cannot read properties of null (reading 'useState')` on mount — so **any**
component test touching a MultiSelect fails until this is present. The full
suite and the production build are both unaffected by the addition.

### …and `optimizeDeps.include` for the same failure on a cold cache

Added 2026-09-02. `dedupe` alone is not enough for a dep vitest discovers
**partway through a run**: it optimizes, reloads the page, and momentarily
resolves a second React, throwing `Invalid hook call` — then passes on every
subsequent run, so it only shows against a cold `node_modules/.vite`.

```ts
optimizeDeps: { include: ['@radix-ui/react-switch'] },
```

Same signature as the `dedupe` case above, which makes it easy to wave off as
already handled. **Anything a component test mounts that is not already reached
from `src/main.tsx` belongs in that list.** Reproduce with
`rm -rf node_modules/.vite` before trusting a green run.

### Seed changes no longer need localStorage hand-clearing

`src/lib/seed-store.ts` stamps `"<key>:seed"` with `SEED_VERSION` next to each
persisted store. Bumping that constant drops every cached blob and re-seeds
from the bundled defaults. **Bump it whenever you edit a `features/*/data/*.ts`
seed** — currently `'2026-09-02-rotation-suggestion'`. The old advice
(`localStorage.removeItem('schedules')` etc.) is obsolete.

### Vitest browser mode — an old failure that has not recurred

`npx vitest run` died before any test with
`Error: listen EACCES: permission denied ::1:63315` in the 08-25/08-26 sessions
(a Windows excluded-port-range problem, **not** the Claude sandbox). It has not
reproduced since — 08-27 and 08-29 both ran the full suite in real browser
mode. Fallback if it returns, for non-DOM test files only:

```
npx vitest run --browser.enabled=false --environment=node <files>
```

## Open calls / follow-ups

1. **Two sidebar entries point at `/schedule-rotation`** (top-level button +
   the Time Track → Schedules leaf). Kept both because the Time Track hierarchy
   is the user's own recent deliberate work — decide whether to drop the nested
   leaf.
2. **Latent display bug in `pattern-builder.tsx` (~line 266)**: the week-count
   readout divides `cycle_length.days` by a hardcoded `6`, but
   `CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS.weekly` is **7**. A 7-day weekly cycle
   renders as `round(7/6)` = "1 week", correct by luck. **Not fixed** — out of
   scope when found, and still is.
3. **Nothing stops an under- or over-staffed rotation.** Crew count vs. position
   count is a convention asserted in tests, not a schema rule — this was a
   deliberate call ("without adding restrictions"). If it should be enforced
   later, note the schema cannot see the shifts store, so the rule can only ever
   look at the pattern.
   **Partly addressed 2026-09-02**: the "Assign to" step's coverage panel now
   *reports* this (and much else) without blocking anything. Note the rule it
   uses is coverage-based, **not** "crews should equal positions" — that
   assumption flags a correct 4-crew Panama as broken. See
   `.claude/handoff/rotation-suggestion.md`.
4. **`shift_repeat` and the rotation screen disagree about a card's length.**
   `schedules/utils.ts#expandRotatePatternDays` expands a `weekly`-frequency
   card into 7 real days for the calendar preview; `getRotationPositions` treats
   every card as exactly one cycle position. Desk Alternation uses `daily`
   cards, so it doesn't bite today.
   **Guarded, not resolved, 2026-09-02**: the Daily tab is disabled whenever
   `getScheduleCycleLength(schedule) !== pattern.length`, so the two engines
   cannot silently contradict each other on screen. They still disagree in
   principle.
5. **The cycle legend decodes the *pattern's* letters**, so on a rotation where
   crews are transposed onto other shifts (every rotation, since 2026-09-06 —
   this is how full coverage is reached) the legend and the rows disagree. Not
   wrong, but more likely to be seen now than when it needed an explicit
   `crew_shift_id` pin. Worth a look.
5. **The shift Assign-to tab is now decorative for rotations.** Kept
   deliberately ("leave the assign to data in the shift for later use"), but
   `/shifts` will show assignments that don't drive anything — worth a label or
   a hint there eventually.
