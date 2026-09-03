# Rotation suggestion — computing who starts where

Built 2026-09-02, corrected 2026-09-03. Turns the rotate schedule's "Assign
to" step from a hand-filled grid into a **suggestion + grading** step: pick the
crews, press one button, get starting positions that flatten coverage, and see
what is wrong with the result either way.

> **2026-09-03 in one line:** the suggestion was traded away a day of zero
> coverage for a smoother shift count, "Next" did not take a pool the user had
> picked but never pressed Suggest on, and the Summary under-reported the
> roster it did take. All three fixed; details in place below.

Companion to `.claude/handoff/schedule-rotation-screen.md`, which covers the
screen those assignments drive.

## The framing that made this small

The user arrived with pseudo-code (a `pattern` list, a `Map<Team, offset>`, and
`pattern[(daysSinceStart + offset) % patternLength]`). **Most of it was already
in the repo**, which is why this landed without reshaping the feature:

| Pseudo-code | Already existed as |
|---|---|
| `pattern[]` of shifts / Off | `schedule.pattern[]` — one card per cycle day |
| `teamOffsets.Get(team)` | the position a crew's `employee_ids`/`team_ids` sit on |
| `(daysSinceStart + offset) % len` | `getAssignedIndex` — same floor-mod |
| `GetDateRange` stepping | `getPeriodIndex` + `shiftPeriod` |

Three things were genuinely missing, and they were the whole job:

1. **Nothing chose the offsets** — a human picked them position by position.
2. **A step was a week or a month, never a day**, so a 14-card 2-2-3 pattern
   described a 14-*week* cycle. Fixed by adding `daily` (see the companion file).
3. **Nothing checked coverage.**

## The algorithm — `src/features/schedules/rotation-suggestion.ts`

Pure, no React, no stores. Two entry points:

- `suggestRotationAssignment(slots, crews, options)` — picks offsets, then grades.
- `analyzeRotation(slots, assignments, options)` — grades an assignment that
  already exists. The panel calls **this** on live form values, so it validates
  hand edits and works for someone who never presses Suggest.

**Search.** Cost = a dominating penalty per day nobody works at all (see
finding 3), then variance of crews-on-duty per cycle day, then (weighted ×2)
variance of per-shift coverage, plus a tiny even-spacing tie-break. One crew is
pinned to offset 0 for free — rotating every offset by the same amount rotates
the coverage array without changing it, killing a whole symmetry class.
Exhaustive over `C(N−1, M−1)` combinations up to `EXHAUSTIVE_LIMIT = 100_000`
(DuPont's 28/4 is 2,925), else an even-spacing seed. Both then go through
`localImprove`, which does **move** and **swap** passes — swaps only matter once
crews differ from each other (different sizes, or a pinned shift), which is
exactly why they are there.

**Why coverage-driven and not even spacing.** Even spacing is optimal only when
the rest mask is uniform. DuPont and Southern Swing are not. There is a test
asserting the search is never worse than even spacing on DuPont.

## Three findings worth not re-deriving

**1. "Fewer crews than cycle days = understaffed" is wrong, and it fires on
correct rosters.** The first cut coded that rule and it flagged a textbook
4-crew Panama (14 cards) as broken. The deeper mistake: **not every roster wants
24/7 coverage** — an office 5-2 leaves two days empty *by design*.

Severity is now decided by **fixability**, not by outcome:

- `error` — nothing to work with (no pattern, or nobody on it).
- `warning` — reassigning would genuinely help; press Suggest.
- `info` — a property of the pattern + crew count that no assignment changes.

The structural test is cheap: a shift can be staffed daily only if its target
(`crew-days ÷ cycle length`) is ≥ 1; a day can be staffed at all only if
`crews × workCards ≥ cycleLength`. Below either, it is `info` with the remedy
spelled out ("4 crews would cover every shift every day"). There is a named
regression test for the Panama case.

**2. The 28-day day/night flip *is* coverable by 4 crews — a test assumed
otherwise and the algorithm was right.** Even spacing (0/3/7/10) puts all four
crews in the same half of the cycle on day one, leaving nights empty. The
coverage search straddles the halves and staffs both shifts every day. Kept as
its own test, because it is the clearest demonstration of why the search exists.

**3. Per-shift balance will buy itself a day with the plant shut, if you let
it (found 2026-09-03).** A 5-2 office week alternating Morning/Afternoon,
two crews. The search returned offsets `{1, 2}` — coverage
`[2, 2, 2, 1, 0, 1, 2]`. Day 5 had **nobody on at all**, bought in exchange for
"exactly one Morning on duty almost every day". `{0, 3}` gives
`[2, 2, 1, 1, 2, 1, 1]` and no blackout, and scored *worse* (10.86 vs 8.86)
because `SHIFT_BALANCE_WEIGHT = 2` outweighed a single squared on-duty term.

A day nobody works is **categorically** worse than a lumpy one, so it is now
priced above everything else the score can add up to rather than competing with
it (`emptyDayPenalty`). The size is a **bound, not a magic number**: both
squared terms are capped by `crewCount²` (each side of the subtraction lies in
`[0, crewCount]`), so `cycleLength × (1 + W × shiftCount) × crewCount²` plus the
spacing tie-break's own ceiling exceeds any reachable total.

This does **not** reintroduce finding 1's trap, and the argument is worth
keeping: when a gap cannot be filled — one crew on a 5-2 week — *every*
candidate pays the same number of penalties, and a constant added to every
candidate cannot change which one is smallest. It only bites when the gap was
avoidable. Both halves have named tests ("never buys shift balance with a day
nobody works", "leaves an unavoidable gap alone rather than chasing it").

## `crew_shift_id` — the one schema addition

Optional field on `rotatePatternEntrySchema`. When set, the crew starting at
that position works **that** shift on every working card instead of the card's
own. Unset (every pre-existing schedule) = exactly the old rotating behaviour.

It exists because a single shared `pattern[]` **cannot** express fixed-shift
crews: over one cycle every crew visits every card, so "Team A always days,
Team B always nights, both on the same 2-2-3 rest mask" — a very common real
roster — had no representation, and no amount of manual assignment could
produce it. Validated in the `superRefine` against `shift_ids`.

Resolved by `applyCrewShift` in `schedule-rotation/utils.ts`; an off card stays
off (being pinned to days does not mean working through rest cards).

**Known boundary that remains:** crews still cannot have *different rest
patterns* from one another — one shared mask, one offset each. That matches the
user's own pseudo-code, so it was not treated as a gap.

## Presets — `src/features/schedules/data/rotation-presets.ts`

14 systems in three groups (Office & simple / Continuous coverage / Named
systems): 5-2, 4-3, 6-2, 4-2, 3-3, 4-4, DDNNOO, Metropolitan, one-card-per-shift,
2-2-3 Continental (Panama), Pitman, 2-2-3 with 28-day day/night flip, DuPont,
Southern Swing.

A preset is only a card list — each entry an **index into the schedule's own
`shift_ids`**, or `null` for rest. That one shape covers both single-shift masks
and multi-shift systems, and the user's 28-day flip becomes plain data with no
`28DayBlock` branch anywhere.

Rendered in `PatternBuilder`'s "Create pattern" card, **`pattern_shifts` only** —
`custom_shifts` rebuilds its cards from `shift_repeat` and would clobber a preset.
Applying one writes `cycle_length` as `{ unit: 'custom_days', days: N }` first,
then `replace()`s the cards, carrying crew across by position (same `crewAt`
convention as the `custom_shifts` rebuild and the drag-reorder).

> `custom_days` is deliberate: 14 and 28 are not whole week/month units, and it
> also sidesteps the hardcoded-`6` week readout (open call #2 in the companion
> file, still unfixed — this path just never reaches it).

There is a test asserting **every preset at its own `suggestedCrews` stays flat
within one crew** — the broadest guard that the search generalises.

## The "Assign to" step — `schedule-assign-to-fields.tsx`

Two cards. **Suggesting is the default path; hand-assignment is an escape
hatch behind a toggle**, which is the shape the UI was revised into late in the
session — the earlier layout put every position's pickers on screen at once and
buried the suggestion in them.

**Card 1 — "Who is on this rotation"**

- Teams/Employees `ToggleButton` pair, then one `MultiSelect` for that kind,
  then "Suggest assignment".
- The pool is **local state, not a form field**: the union of what is already
  assigned *is* the pool, so it round-trips a saved schedule with no schema
  change. The component unmounts when the wizard leaves the step
  (`schedule-form.tsx` gates on `currentStepId === 'assign-to'`), so returning
  re-derives it from the pattern — desired behaviour, not an accident.
- **Coverage panel** (`rotation-coverage-panel.tsx`) — crew × cycle-day grid
  plus an "On duty" footer row, fed by `analyzeRotation` on live form values.

**Card 2 — "Assign manually"**, gated by a `Switch`, off by default.

- One `Card` per cycle day in a `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`,
  deliberately mirroring the Pattern step's own day cards so the two screens
  read as the same grid.
- The shift is a **disabled** `SelectDropdown` — same control as the pattern
  step, greyed. The pattern owns the shift; this step only decides who works it.
- The live dropdown is the crew, and it offers **only the kind picked above**,
  never Employees *and* Teams side by side.
- The `crew_shift_id` pin appears only on cards that already have a crew and
  only when there is more than one shift to pin to, so most cards stay two
  controls tall.

Suggest writes **every** position, not just the ones receiving someone —
otherwise a crew left over from a previous run silently double-books.

`getStepFields` still returns `['pattern']`, so nothing here blocks Next —
consistent with the deliberate "no new restrictions" call.

### "Next" accepts the step (added 2026-09-03)

Pressing the button already wrote straight into `pattern[]`, so the assignment
always survived Next — verified by driving the whole wizard in real Chromium
(`schedule-form.test.tsx`), not assumed. What did **not** survive was a
suggestion the user never asked for explicitly:

- pick a pool, never press **Suggest assignment**, press Next → advanced with
  the old (or empty) roster, and nothing downstream said so;
- press Suggest, *then* add a crew to the pool, press Next → the added crew was
  silently dropped.

`commitPendingSuggestion` now runs when the step is left. It compares the pool
against the crews actually on the pattern and re-runs the suggestion only when
they differ, so straight after pressing the button it is a no-op. **Manual mode
is skipped entirely** — that toggle is the escape hatch for rosters the search
cannot express, so re-running the search over hand-placed crew would destroy
the exact work it exists to allow.

Plumbed as a `commitRef` the step fills in from an effect with **no dependency
list** (the callback closes over live pool state, so the form needs a fresh one
after every render), called from `handleNext` **before** `form.trigger` so
validation sees the crew being advanced with. Fires on **Next only**, not on
the vertical-tab rail — jumping backward should not silently rewrite the
pattern. Revisit if that asymmetry ever confuses anyone.

### ⚠️ Flipping Teams/Employees used to copy ids into the wrong field

Found 2026-09-03 by the manual-mode test, pre-existing. With the manual grid
**open**, toggling the crew kind changed the `FormField`'s `name` from
`pattern.N.employee_ids` to `pattern.N.team_ids`; react-hook-form re-registers
the controller under the new name **while it still holds the old one's value**,
so `team_ids` ended up holding employee ids (`team_ids: ['emp-a']`). Those
resolve to no team, so the coverage grid looked empty while the schedule saved
garbage.

Fixed with `key={crewField}` on that `FormField` — remounting reads the new
field instead of re-registering with the stale value. **Any `FormField` whose
`name` is computed from state needs this.**

### The warning list is computed but not rendered

`analyzeRotation` still returns `warnings`, and they are still exported and
tested — the **panel just does not display them**. Two rounds of feedback got
there: first the leading severity icons came off, then the prose list went
entirely.

The reason is worth keeping: the list emitted **one near-identical line per
shift** ("One shift sits unstaffed on 4 days of the cycle…") without ever
naming *which* shift, so a two-crew roster produced three nearly identical
paragraphs and read as a wall of complaints about a correct pattern. The grid
already carries the same signal — a thin day shows as `1` in the On-duty row
with a visible `·` gap in some crew's row.

**If these are ever surfaced again, rewrite the messages first** (name the
shift, collapse the per-shift repetition into one line). Do not just re-render
the list as-is.

## The Summary read-back (rewritten 2026-09-03)

`AssignToSummary` listed the stored data literally — one row per pattern
position, crew or a dash. Correct, and badly misleading: two crews on a
seven-card week rendered as **five dashes**, which reads as "the assignment was
lost", not "the crews are staggered". The user reported it as the Summary "not
being the same as the suggested assignment"; it was the same data, shown in a
form that hid the rotation.

It now repeats **the same coverage grid the step ends on**, then lists only the
positions someone actually starts on, under a line saying they are starting
points and that the rest days travel with each crew. Positions nobody starts on
carry no information once the grid is there — and in any rotation with fewer
crews than cards, most positions are empty by definition.

That required both screens to reconstruct crews from the pattern the same way,
so `patternToSlots` + `assignmentsFromPattern` moved out of the step into
**`src/features/schedules/rotation-crews.ts`**. It deliberately keeps
`rotation-suggestion.ts` schema-free: the pure module still knows nothing about
`RotatePatternEntry`, and this new one is the only bridge between the stored
shape and the search's own types.

> Same root cause as the "days 6 and 7 have teams on them?" question that
> opened the session: **the grid's columns are cycle days, not pattern cards.**
> Each crew is at its own offset, so a card's Off-ness is per crew. The two
> rest cards travel; they are not a weekend. If every crew must rest on the
> same days, that is a *fixed* schedule (or a one-crew rotation), and the UI
> should probably say so somewhere — it currently does not.

## Seed — the third rotation

`sched-panama-223` "Plant Coverage (2-2-3)": 14-day mask, 4 crews, two pinned to
mornings and two to nights. Read it on the **Daily** tab.

The starting positions (0, 3, 7, 10) are **not arbitrary**. The crews pair up
differently day to day — {0,10}, {0,3}, {3,7}, {7,10} — which forms a 4-cycle,
so both shifts are covered every day only because the pins alternate around it
(0 and 7 mornings, 3 and 10 nights). Move one crew and a day loses night cover.
`scenario.test.ts` locks all 14 days, both shifts, equal 7-day workloads, and
the wrap on day 15.

> Got this wrong once while writing it — put `emp-c` on position 9 instead of
> position 8. Positions are 1-based, offsets 0-based, and both those cards are
> rest cards so it looks identical in the UI. Check offsets, not appearance.

**`SEED_VERSION` bumped to `'2026-09-02-rotation-suggestion'`** — required, or a
browser that has already opened the app keeps its cached `schedules` blob.

## Files

**New:** `schedules/rotation-suggestion.ts` + `.test.ts`,
`schedules/data/rotation-presets.ts`,
`schedules/components/schedule-form/rotation-coverage-panel.tsx`,
`schedules/rotation-crews.ts` *(09-03)*,
`schedules/components/schedule-form/schedule-form.test.tsx` *(09-03)*

**Changed:** `schedules/data/schema.ts` (`crew_shift_id` + its refine),
`schedules/data/schedules.ts` (third seed), `schedule-assign-to-fields.tsx`
(+ its test), `pattern-builder.tsx` (preset picker), `schedule-summary.tsx`
(shows the pin; 09-03 rewrite of the roster read-back),
`schedule-form.tsx` *(09-03, the commit ref)*,
`schedule-rotation/{utils,data,index}.tsx|ts`,
`schedule-rotation/components/schedule-rotation-table.tsx`, `lib/seed-store.ts`,
`schedule-rotation/{utils,scenario}.test.ts`, `vite.config.ts` (see the gotcha
below)

## ⚠️ Cold-cache "Invalid hook call" — `optimizeDeps.include`

Adding the manual-mode `Switch` pulled in `@radix-ui/react-switch`, which
vitest's browser mode optimized **mid-run**, reloaded the page, and briefly
resolved a second React — throwing `Invalid hook call` across the file. It
passed on every run afterwards, so it only reproduces on a **cold**
`node_modules/.vite`.

That is the same signature the existing `resolve.dedupe` comment describes,
which makes it easy to dismiss as already handled. Fixed by pre-bundling:

```ts
optimizeDeps: { include: ['@radix-ui/react-switch', '@radix-ui/react-popover'] },
```

**It recurred on 2026-09-03, exactly as predicted**, the first time a test
mounted the whole `ScheduleForm` (popover, via the date/calendar fields) — same
`Invalid hook call`, gone on the second run. `@radix-ui/react-popover` added.
Re-verified with `rm -rf node_modules/.vite`.

**Anything a component test mounts that is not already reached from
`src/main.tsx` belongs in that list.** Verified by `rm -rf node_modules/.vite`
and re-running. Sibling note in
`.claude/handoff/schedule-rotation-screen.md`'s gotcha section.

## Status (2026-09-03)

- `npm run build` **clean**.
- `npm run test` — **229 passed / 3 failed**, the 3 being the pre-existing
  unowned `search-provider.test.tsx` failures. (Baseline was 174/3 before this
  feature; 224/3 at the end of 2026-09-02; +5 this session — three in the new
  `schedule-form.test.tsx`, two in `rotation-suggestion.test.ts`.)
- `npx eslint` on `features/schedules`, `features/schedule-rotation`,
  `lib/seed-store.ts` — **0 errors**, 3 warnings, all pre-existing (two
  `exhaustive-deps` in `pattern-builder.tsx`, one `incompatible-library` in
  `schedule-form.tsx`).
- Prettier: every file this session created **or** that was clean at HEAD is
  clean. Deliberately did not touch the repo-wide drift.
- **Still NOT browser-verified by hand.** No browser automation in either
  session. Coverage in real Chromium is now two layers:
  `schedule-assign-to-fields.test.tsx` (manual toggle, one card per cycle day,
  disabled shift field, single-crew-kind, off-day write-back, pool → Suggest →
  staggered offsets) and **`schedule-form.test.tsx`, new 09-03**, which drives
  the whole wizard — basics → shifts → pattern → assign-to → Next → Next →
  Save — and asserts on the submitted payload. That covers the *flow*; it does
  not look at anything. **Two pieces of markup have still never been seen:**
  the day-card grid at 2/3/4 columns, and the Summary's new grid + starting-
  position list.
- **Uncommitted** at handoff time — now two sessions' worth.

## Open calls / follow-ups

1. **Browser-verify.** In order: preset → 14 cards render and cycle length
   reads 14; **Assign to** → pool of 4 → Suggest → "On duty" reads `2` under
   every one of the 14 columns; flip **Assign manually** on → 14 day cards in a
   2/3/4-column grid, each with a **greyed** shift field above a live crew
   dropdown, and only one crew kind offered; move one crew there by hand → the
   On-duty row reacts immediately (proves the panel reads live form state, not
   the last suggestion); step back to Pattern and return → crew survives;
   **Next → Next → Summary → the coverage grid there matches the one on the
   step**, with only the started-on positions listed under it (09-03 markup,
   never seen); `/schedule-rotation` → *Plant Coverage (2-2-3)* → Daily tab
   steps one card per day.
   Also worth one pass on the 09-03 fixes specifically: a **5-2 preset with 2
   crews** must come back with **no red `0`** in the On-duty row, and toggling
   Teams ⇄ Employees **with the manual grid open** must not put employee names
   in a team field.
2. **`crew_shift_id` has no UI on the rotation screen's legend.** The cycle
   legend still decodes the *pattern's* letters, so a pinned crew's row shows its
   own shift while the legend shows the card's. Not wrong, but potentially
   confusing on a mixed rotation.
3. **The Daily tab is withheld when one card is not one real day** —
   `getScheduleCycleLength(schedule) !== pattern.length`, which is the
   weekly-`shift_repeat`-card case (open call #4 in the companion file). This
   guards the disagreement rather than resolving it; the two engines still
   disagree in principle.
4. **`analyzeRotation` runs the full cost function on every relevant form
   change.** Memoised on `[slots, assignments, startDate]` and cheap at these
   sizes, but it is not incremental — a very long cycle with many crews would be
   worth profiling before assuming it stays free.
5. **Crews cannot have different rest masks** (see the boundary note above).
   Would need independent pattern groups; deliberately out of scope.
