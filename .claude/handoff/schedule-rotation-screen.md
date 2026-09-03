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
> **Extended 2026-09-02** with a `daily` step and per-crew fixed shifts. Both
> are noted inline below; the full account is in
> `.claude/handoff/rotation-suggestion.md`.

- **The crew is stored on the schedule's pattern.** Each entry of
  `pattern[]` carries `employee_ids` / `team_ids` (see
  `rotatePatternEntrySchema`), set on the schedule form's own **"Assign to"**
  step. `getRotationRoster` reads these and **nothing else** — a position's
  shift is consulted only for its name, letter and badge colour.
- **A position's pick is that crew's starting slot.** Someone assigned to the
  Morning position starts the cycle on Morning. An **off position is
  assignable like any other**, which is how "this crew starts on a rest day"
  gets expressed — it has no shift of its own to carry a pick.
- **One step per period**: `assignedIndex = (offset + periodIndex) mod
  cycleLength`, where `offset` is the position the crew was assigned to and
  `periodIndex` is whole days/weeks/months between the viewed period and the
  `start_date` period. Off positions are ordinary cycle members — everyone
  rotates through them. The Daily/Weekly/Monthly toggle only changes *what one
  step means*; it is independent of `cycle_length`.
- **`daily` is what a day-based pattern needs** (2-2-3, 4-on-4-off, DuPont):
  one card advances one calendar day, so the composition is literally
  `(daysSinceStart + offset) mod patternLength`. Read through the weekly step
  the same cards would describe a cycle seven times longer. It is **disabled**
  when `getScheduleCycleLength(schedule) !== pattern.length` — the
  weekly-`shift_repeat`-card case in open call #4 below, where one card really
  does span a week.
- **`pattern[].crew_shift_id` (optional) pins a crew to one shift.** Set, the
  crew works that shift on every working card instead of the card's own;
  unset — every schedule written before 2026-09-02 — it rotates as before.
  It exists because a shared `pattern[]` alone **cannot** express fixed-shift
  crews: over one cycle every crew visits every card, so "Team A always days,
  Team B always nights, same rest mask" had no representation at all. Resolved
  by `applyCrewShift`; an off card stays off.
- **`cycleLength === pattern.length`**, regardless of `cycle_type`. This
  screen never reads `cycle_length.days` or `shift_repeat`.
- **Shifts keep their own "Assign to" tab**, and their `employee_ids` /
  `team_ids` are kept as sample data. They say who *may* work a shift; they no
  longer decide who holds which slot of a rotation.

Core logic is pure in `src/features/schedule-rotation/utils.ts`
(`buildRotation`, `getRotationPositions`, `getRotationRoster`, `getAssignedIndex`,
`applyCrewShift`, period helpers), unit-tested in `utils.test.ts` and locked
against the real seeds in `scenario.test.ts`.

Choosing the offsets in the first place lives elsewhere and is pure too —
`src/features/schedules/rotation-suggestion.ts`, driven from the form's
"Assign to" step. This screen only ever *reads* the result.

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
  each with Employees + Teams multi-selects, built from the same `MultiSelect`
  the shift form's own Assign-to tab uses.
- `getRotationRoster` now reads `pos.employeeIds` / `pos.teamIds` only.
- `pattern[].employee_ids` / `team_ids` stop being an off-slot special case and
  become the whole roster. **No schema restriction was added** — an unassigned
  position stays valid and the step never blocks "Next".
- `pattern-builder.tsx`'s `custom_shifts` rebuild now carries crew across by
  position. Without it, stepping back to Pattern and changing an interval
  silently emptied the roster.
- The Summary step gained an "Assign to" section; the rotation screen's
  "no employees" empty state now points at the schedule's step rather than the
  shift's tab.

**Deliberately not done:** the step is rotate-only (fixed/flexible have no
pattern to attach crew to, and a schedule-wide roster field would need a schema
change with no consumer), and there is no `assign_to_enabled` toggle at
schedule level.

## Seed data — three scenarios

Rewritten 2026-08-29, third added 2026-09-02. The first two are the same shape
at different sizes: **one cycle position per shift plus a rest slot, and one
crew per position**, so every crew covers every shift and exactly one is off at
a time. The third is deliberately a different animal — a pure rest mask read
daily, with crews pinned to shifts.

| Schedule | Crew | Cycle | Pattern type | Read on |
|---|---|---|---|---|
| **Shift Rotation** | Team A — Amir, Bilal, Carla, Dana | 4 — `M A N O` | Rotate pattern (`pattern_shifts`) | Weekly |
| **Desk Alternation** | Team B — Elias, Farah, Ghassan | 3 — `E L O` | Custom alternate (`custom_shifts`) | Weekly |
| **Plant Coverage (2-2-3)** | Amir, Bilal, Carla, Dana as four one-person crews | 14-day 2-2-3 mask | Rotate pattern (`pattern_shifts`) | **Daily** |

Plant Coverage is the fixed-shift case: offsets 0/3/7/10, with 0 and 7 pinned
to Morning and 3 and 10 to Night. Those pins are load-bearing — the crews pair
up differently day to day ({0,10}, {0,3}, {3,7}, {7,10}, a 4-cycle), so both
shifts are covered every day only because the pins alternate around it. Move one
crew and a day loses its night cover.

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

> **2026-09-02 supersedes the numbers below**: `npm run build` clean;
> `npm run test` **221 passed / 3 failed** (same three unowned
> `search-provider.test.tsx` failures); `npx eslint` **0 errors**, 3 warnings,
> all pre-existing. `scenario.test.ts` now also locks the Plant Coverage seed
> day by day, and `utils.test.ts` covers the `daily` step. Still **not
> browser-verified**, and **uncommitted**.

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
  `pattern.3.employee_ids`.
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
5. **The cycle legend decodes the *pattern's* letters**, so on a rotation using
   `crew_shift_id` a pinned crew's row shows its own shift while the legend
   shows the card's. Not wrong, but worth a look on a mixed rotation.
5. **The shift Assign-to tab is now decorative for rotations.** Kept
   deliberately ("leave the assign to data in the shift for later use"), but
   `/shifts` will show assignments that don't drive anything — worth a label or
   a hint there eventually.
