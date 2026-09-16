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
- **"Assign crews" button** — opens the assignment **dialog** (2026-09-12).
  **As of 2026-09-16 this is the only place a rotate roster is placed** — the
  wizard's "Work rotation" step was removed; the wizard only picks the pool,
  which pre-fills the dialog. Detail:
  `.claude/handoff/schedule-wizard-assign-steps.md`.
- **Date navigator** — prev / range label / next / **Reset**. Reset returns to
  the schedule's `start_date` period (rotation period 0). Prev is always
  enabled (the 2026-09-12 start-date disable was reverted 2026-09-13 — see
  "The grid draws whole periods").
- **Two views, each with its own Weekly / Monthly tabs** (2026-09-12; one
  shared control before that, and a Daily/Weekly/Monthly one before *that*).
  Both are seeded from `getDefaultSpan(schedule)` — `cycle_length.unit`,
  falling back to pattern length for `custom_days` — and re-seeded when the
  schedule picker changes. They are separate because the two views answer
  different questions, and comparing a month of bands against this week's
  roster should not cost you one or the other. A starting point, not a lock:
  both stay clickable.
  - **Timeline** (`components/rotation-timeline.tsx`, built from
    `timeline.ts`) — one row per **crew**, one coloured dot per calendar day,
    days blocked in sevens. Its own legend decodes the dots. Each row shows
    headcount, days-on, and **the date that crew starts**.
  - **Employees** (`components/schedule-rotation-table.tsx`) — Employee Name ·
    Current Schedule Sequence · Assigned Shift · *one named day*. The sequence
    is the cycle rotated so the employee's current position is first and
    emphasized (Amir `M A N O`, Bilal `A N O M`). Its tabs **filter rows** to
    people working at least one day of the selected week/month; somebody the
    matrix never mentions stays listed rather than vanishing.
- **Cycle legend** — decodes the sequence letters (`M = Morning`, …, `O = Off`),
  now sitting in the Employees section header.

### The grid draws whole periods (2026-09-13)

**Decision locked by the user: keep a dot for every day of the week/month.**
On 2026-09-12 two clamps were added (days before `start_date` dropped; each
crew blank until its first working day) plus Prev disabled at the start. They
were **reverted 2026-09-13** because every seed starts **2026-08-31 — the last
day of August** and the screen opens on that date, so Monthly showed **one dot
per crew** and Prev could not reach a full month. Tests and build never saw
it: the clamp tests used mid-month schedules, and nobody had opened Monthly
on a seed. Days before the start now wrap back through the cycle
(`getAssignedIndex` handles negative period indices).

Kept from 09-12: the **"Starts <date>" line under each crew** (`crewStartDate`
in `timeline.ts`, walked through `getPeriodIndex`). Regression test:
`timeline.test.ts` "draws the whole month even when the schedule starts on its
last day". The Employees table's period filter lost its matching clamp too.

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
> **Relocated 2026-09-11, then again 2026-09-12**: producing the matrix (the
> "Assign to" step) moved *out* of the schedule wizard onto a page owned by
> this feature, and that page then became a **dialog** —
> `components/assign-crews-dialog.tsx`. The route and `pages/assign/` are
> **deleted**. See "Where assignment lives" below. This screen's own read-only
> display is unaffected — it still only ever reads `day_coverage`.

- **The crew is stored on the schedule as a matrix.** `schedule.day_coverage`
  is a sparse list of `{ day, shift_id, employee_ids, team_ids }` cells — a
  (cycle day × shift) → crews grid — set via the **"Assign crews"** dialog on
  this screen. `getRotationRoster` reads that and **nothing else**.
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
- **A shift's own `employee_ids` / `team_ids` are sample data only.** They say
  who *may* work a shift; they have not decided who holds a rotation slot since
  2026-08-29, and **as of 2026-09-12 the shift form no longer offers the tab
  that sets them** (the fields and the component stay; see
  `.claude/handoff/teams-and-shift-assignment.md`).
- A crew hand-placed on **two shifts the same day** renders as the first one
  here rather than flickering; the form warns about it in place
  (`crew-double-booked`).

Core logic is pure in `src/features/schedule-rotation/utils.ts`
(`buildRotation`, `getRotationPositions`, `getRotationRoster`,
`getAssignedIndex`, period helpers), unit-tested in `utils.test.ts` and locked
against the real seeds in `scenario.test.ts`. `applyCrewShift` was **deleted**
2026-09-06 with `crew_shift_id`.

The crew-by-day view is a **separate** pure module,
`src/features/schedule-rotation/timeline.ts` (`buildRotationTimeline`), tested
in `timeline.test.ts`. It answers a different question from `buildRotation`:
per *crew* across consecutive days, rather than per *employee* for one day.
Both read `day_coverage` through `crewsFromDayCoverage`, so they cannot
disagree about a cell.

Producing the matrix lives elsewhere and is pure too —
`src/features/schedules/rotation-suggestion.ts`, driven from
`schedule-assign-to-fields.tsx`, which since 2026-09-12 is mounted inside this
feature's **assign dialog**. This screen only ever *reads* the result.

## Where assignment lives — a page (2026-09-11), now a dialog (2026-09-12)

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
- **It is a dialog, not a page** (2026-09-12).
  `components/assign-crews-dialog.tsx` holds it; the route
  `/schedule-rotation/assign` and the whole `pages/assign/` directory are
  **deleted**, along with the `?scheduleId=` search param — the dialog takes
  the currently-viewed schedule as a prop instead. Staffing a rotation no
  longer costs a navigation away from the grid showing the result.
  Two parts: a `Select` over **every** rotate schedule (assigned or not — the
  same dialog serves first-time assignment and re-edit), grouped into
  **"Not assigned"** / **"Assigned"** with a crew-count status per option
  (`crewKeysFromDayCoverage`); then, once picked, a small local `useForm`
  (no `zodResolver` — the fields it touches are optional/warning-only at
  the schema level, so there's nothing to validate) seeded from that
  schedule's `pattern`/`shift_ids`/`start_date`/`end_settings`/
  `day_coverage`/`crew_placements`, mounting **`ScheduleAssignToFields`
  unchanged** plus (**new**) `ScheduleStartEndFields` unchanged, under one
  "Save assignment" button. Save calls `commitRef` (same ordering the
  wizard's "Next" used), then `updateSchedule(schedule.id, { ...schedule,
  pattern, day_coverage, crew_placements, start_date, end_settings })`, then
  closes the dialog.
- **The picker defaults to the first *unassigned* schedule** (2026-09-12),
  falling back to the one being viewed — opening this is almost always an
  attempt to staff something that is not staffed yet.
  **⚠️ Every rotate seed is staffed**, so with seed data the dialog always
  opens on the fallback. A test asserted the unassigned-first behaviour
  against the seeds and correctly failed until it built its own unstaffed
  schedule. Do not "fix" that test by loosening it.
- **Entry point**: an "Assign crews" button next to this screen's own
  schedule `Select`. The dialog is mounted only while open
  (`{assignOpen && <AssignCrewsDialog …/>}`) so its default selection
  re-seeds on every open without an effect — which also keeps the React
  Compiler quiet (see the gotcha below).
- **Both pickers inside it carry an A-Z first-letter filter** (2026-09-12) —
  `components/multi-select/filterable-multi-select.tsx`. See
  `.claude/handoff/rotation-suggestion.md` for how it behaves.
- **Wizard Summary + View page** (2026-09-13; Work rotation step removed
  2026-09-16, so the View page shows only "Assign to"): the View page renders
  the wizard steps read-only, and the Summary lists the picked crews plus
  `assign-to-status-note.tsx`'s neutral "Not yet assigned." / "N crews
  assigned." (no longer pointing at Schedule Rotation). Saving the dialog now
  also writes the wizard's `crew_kind`/`crew_ids` pick. Full detail:
  `.claude/handoff/schedule-wizard-assign-steps.md`.
- **Tests**: `schedule-form.test.tsx` (nothing but the wizard-seam
  rotate-assignment suite) was deleted outright. Its 3 seam tests now live in
  `components/assign-crews-dialog.test.tsx`, driving "Save" instead of "Next"
  against an `AssignToPanel` component exported for testing, with
  `useSchedulesStore`/`sonner` mocked rather than hitting the real store
  (the `useNavigate` mock went with the page). Three dialog-level tests were
  added 2026-09-12 for the picker's default and its status labels. Its 4th
  test was already redundant with
  `scenario.test.ts`'s general "every seeded cycle" loop and wasn't
  re-added. Two more tests added for the new Start & End fields
  (round-trips unedited; saves an edited end frequency).
- **No schema or data migration.** `day_coverage`/`crew_placements` already
  defaulted to `[]`. `SEED_VERSION` not bumped.
- **New `optimizeDeps.include` entries**: `react-day-picker` (2026-09-11,
  from `ScheduleStartEndFields`'s date picker) and `@radix-ui/react-dialog`
  (2026-09-12, for the dialog test) — same class of issue as the
  `@radix-ui/*` entries already there (see the gotcha section below).

**Still open:** this screen's `Select` and the dialog's `Select` remain two
separate pieces of state — the dialog deliberately does *not* follow the
screen's selection, since it prefers an unassigned schedule. Saving does not
switch the screen to the schedule that was just staffed.

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
  **Pattern** and **Start & End** —
  `schedule-form/schedule-assign-to-fields.tsx`. One row per cycle position,
  each with Employees + Teams multi-selects, built from the same picker the
  shift form's own Assign-to tab used.
  Its shape has changed since (see 2026-09-06 below). It left the wizard on
  2026-09-11 for the **"Assign crews" dialog**, and **came back on
  2026-09-13** as two wizard steps — "Assign to" (crew pick) then "Work
  rotation" (the same component) — while the dialog stays. (The shift form's
  Assign-to tab is itself no longer rendered, as of 2026-09-12.)
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

## Status — 2026-09-12

- `npm run build` **clean**. `npm run test` — **362 passed / 0 failed**
  (349 before this session's feature work; 273/3 at the end of 09-11).
  **The three long-standing `search-provider.test.tsx` failures are gone** —
  fixed 2026-09-11, they were never flaky, they asserted nav entries that had
  been commented out of `sidebar-data.ts`. Any note elsewhere still calling
  them "pre-existing, unowned" is stale.
- `npx eslint` — **clean on every file this feature owns**. Repo baseline is
  11 errors / 3 warnings in five files none of this touched.
- **BROWSER-VERIFIED 2026-09-12 — the first time in this repo.** Driven with
  Playwright against the real dev server (there was no Claude-in-Chrome in the
  session; `playwright` resolves from `node_modules`, but the script has to
  live **inside the project** or node cannot resolve it). Confirmed:
  - Both views render with their own Weekly/Monthly tab pairs.
  - Crew start dates read under each name, and a crew starting a day late has
    a genuinely blank leading cell.
  - Prev is disabled at the schedule start and re-enables after stepping
    forward.
  - "Assign crews" opens a dialog with **no navigation** (URL unchanged).
  - The A-Z strip renders, with letters nobody's name starts with disabled.
  - The shift form shows three tabs and no Start date field.
- **Disproved a worry while verifying**: these pickers do **not** portal their
  menu (only `team-form-dialog.tsx` passes `menuPortalTarget`), so the
  dialog's `onInteractOutside` guard is **inert today**. It was kept — adding
  a portal later would reintroduce the bug `1fed0b6` fixed — but the comment
  was corrected to stop claiming it fixes something live. Also checked: the
  inline menu is **not clipped** by the dialog's `max-h-[70vh] overflow-y-auto`
  even for the bottom-most picker of the manual grid; react-select flips it
  upward.
- **Committed, not pushed.** Eight commits sit on local `main`.

### ⚠️ The 2026-09-12 merge — read before trusting any older claim here

The local checkout was **5 commits behind `origin/main`** (what GitHub Pages
serves) while holding an uncommitted cleanup batch. **Both sides had moved
rotate's crew assignment in opposite directions**: local dropped the wizard's
"Start & End" step and kept "Assign to"; the remote dropped "Assign to" and
kept "Start & End". **The remote won.** Rotate's wizard is
`basics → shifts → pattern → end-settings → summary`, and **rotate does have a
"Start & End" step**. A claim in this file that it does not was left over from
the losing branch and has been deleted. `bridge/` is now gitignored.

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
optimizeDeps: {
  include: [
    '@radix-ui/react-switch',   // 09-02
    '@radix-ui/react-popover',  // 09-03
    'react-day-picker',         // 09-11
    '@radix-ui/react-dialog',   // 09-12
  ],
},
```

Same signature as the `dedupe` case above, which makes it easy to wave off as
already handled. **Anything a component test mounts that is not already reached
from `src/main.tsx` belongs in that list.** Reproduce with
`rm -rf node_modules/.vite` before trusting a green run.

### ⚠️ The React Compiler rejects manual `useMemo` in `index.tsx`

Found 2026-09-12. `buildWorkDays` and `employeeRows` are deliberately plain
functions/IIFEs, not `useMemo` — **do not "optimize" them back.** The
`useMemo`s in `assign-crews-dialog.tsx` are fine; the rule fires on some
shapes and not others, so check with eslint rather than by analogy.

Full write-up in the global skill **`react-compiler-rejects-manual-usememo`**
(why it is an error, why it de-optimizes the whole component, and why an
eslint-disable is the wrong fix).

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
   `crew_shift_id` pin. Worth a look. **Note the timeline has its own legend**
   keyed off `shift_ids` in clock order, which does *not* have this problem —
   only the Employees section's legend does.
6. ~~**The shift Assign-to tab is decorative for rotations** — worth a label or
   a hint.~~ **Resolved 2026-09-12** by removing the tab from the shift form
   entirely (fields and component kept).
7. **Saving the assign dialog does not re-point the screen** at the schedule
   just staffed. Minor, but the dialog can now leave you looking at a different
   rotation than the one you edited.
8. ~~**No seeded rotation demonstrates the start-date clamp.**~~ **Moot
   2026-09-13** — the clamps were reverted (see "The grid draws whole periods").
9. **The Monthly timeline revert is not browser-verified.** Build clean and
   62/62 schedule-rotation tests pass; open `/schedule-rotation`, Monthly, on
   any seed and confirm ~31 dots per crew row.
