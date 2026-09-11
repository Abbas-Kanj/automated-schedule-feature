# Rotation crew offsets, guardrails, and what a pattern really costs in crews

**Status: built and shipped.** Two commits, both pushed to `main`:

- `7c9cb5a` (2026-09-10) — crew start days, the rest guardrail, three presets.
- `4531085` (2026-09-11) — the crew-requirement explanation and `crewDayBound`.

Working tree clean. Nothing here is in flight except the open calls at the
bottom.

## Where this came from

On 2026-09-08 four real-world rotation write-ups were checked against the
rotate model. The patterns themselves already worked; four gaps were found and
three scope questions were left unanswered. They were answered on 09-10:

- **Crew offsets → persist + editable.**
- **Guardrails → delegated.** Chosen: quick-turnaround warning, surfacing the
  hidden alignment warnings, forward rotation as a scorer *tie-break only*.
  **Weekend equity as a scoring term was deferred** — one write-up mentions it,
  `weekend-imbalance` already warns, and stacking two new scoring terms makes a
  regression unattributable.
- **Presets → all three.**

## Decisions locked

- **`day_coverage` is the source of truth.** `crew_placements[]` is a
  *generator record* stored beside it, never instead of it. Free cell editing
  can produce a roster no pair of offsets describes, which is why 09-06 removed
  offsets in the first place; they came back additively.
- **Staleness is re-derived, never flagged.** `dayCoverageMatchesPlacements`
  regenerates cells and compares. A `stale` boolean has to be cleared on every
  path that touches a cell, and the one path that forgets makes the record lie.
- **Rest is measured in clock hours, never in shift-list positions.** Ordered by
  start time, Night → Morning steps one place *forward* while being the
  textbook quick turnaround (off 06:00, back on 06:00). An index-based rule
  waves through the one transition the check exists to catch.
- **The scorer's rest term is gated on `shiftHours` being supplied**, so every
  caller that does not pass it scores exactly as before. No test rebaselining
  was needed and none was done.
- **Warn, don't block.** Unchanged. An unstaffed shift is never a validation
  error; the coverage panel carries the whole message.

## What exists now

### Crew start days

`rotateFieldsSchema` carries `crew_placements: { crew, day_offset, shift_step }[]`,
`crew` being the `team:<id>` / `employee:<id>` key the pool already uses.

In `rotation-crews.ts`: `cellsFromCrewPlacements` (stored shape in, cells out —
`cellsFromPlacements` delegates to it), `crewPlacementsToStored`,
`dayCoverageMatchesPlacements`, `shiftHoursById`.

Surfaces in three places:

- **Assign to** — `CrewStartEditor` in `components/schedule-form/rotation-crew-starts.tsx`.
  A "Day N · week M" select and a shift-track select per crew. Shift-track
  options are labelled by **the shift the crew actually opens on**, never the
  stored step number. Changing either regenerates the whole matrix via
  `applyPlacements` — regenerated, not patched.
- **Summary** — `CrewStartSummary`, read-only, reads the opening shift off the
  *stored matrix* so it stays honest after a hand edit.
- **`/schedule-rotation`** — `RotationRow.crewKey`/`crewLabel`/`startDay`;
  "Team B · starts day 8 · week 2" under the employee name. `startDay` is only
  filled when the placements still describe the matrix, checked once per table
  in `buildRotation`.

Both Radix `Select`s carry the `if (!value) return` guard from the
`radix-select-bubble-select-wipes-programmatic-value` skill — every value here
is programmatically set, which is the trigger.

### Quick-turnaround guardrail

`findQuickTurnarounds` + a `quick-turnaround` warning code + `shiftHours` /
`minRestHours` (default 11) on `AnalysisOptions`. Wraps the cycle seam. Uses the
tightest reading (latest finish into earliest start) where a hand edit
double-books a day. **One warning line, not one per occurrence** — a list of
near-identical paragraphs is how this panel stopped being read on 09-02.

Does nothing without `shiftHours`; guessing would be worse than silence.

### Alignment warnings are visible

`SHOWN_INFO_CODES` in `rotation-coverage-panel.tsx` lets `weekday-anchor` and
`weekday-drift` through alongside `uncovered-shift`. `schedule-summary.tsx` now
passes `startDate` **and** `shiftHours`; it passed neither, so weekday, weekend
and rest warnings were all silently absent there.

### The crew-requirement explanation

`CrewRequirement` gained **`crewDayBound`** — cells ÷ working-days-per-crew,
the sum a person does in their head. Where it differs from `minimumCrews`, the
"Assign to" note now accounts for the gap instead of printing a headline of 4
above arithmetic that reads as 3.

### Presets

`weekly_forward_28`, `master_49`, `healthcare_five_two`, all "Named systems".
`ddnnoo`'s description was rewritten: it is the exact-fit two-shift answer
(3 crews, 12 crew-days, 12 cells) and was described in day/night terms that hid
that.

## The crew-count arithmetic — read this before touching `crewRequirement`

Reported as a bug ("why does a 2-shift rotation need 4 teams?"). It is not a
bug, and the reasoning is worth keeping because it is easy to get wrong twice.

**Why a plain 5-on/2-off over 2 shifts needs 4 crews.** Both shifts run daily
and nobody works two at once → ≥2 crews on duty every day = 14 crew-days.
Three crews × 5 working days = 15, so only one spare, so **at most one crew is
off on any day**. Each crew is off 2 days → 6 off-days on 6 distinct days. On
each, the two working crews must be on opposite shifts — so **all three pairs**
(A,B), (A,C), (B,C) must be opposite at some point. On a pattern where every
card names the same shift a crew never changes shift, so that needs three
pairwise-different values out of two shifts. Impossible → 4.

**The `five_two` preset is single-shift by design** (office week, one crew, one
shift). That is what forces the 4, not the shift count.

**Verified by exhaustive enumeration** (all 2,187 seven-card patterns, plus
every pattern up to 7 cards), for 2 shifts and 3 crews:

| pattern | cycle | note |
|---|---|---|
| `M A ·` | 3 | exact fit, zero warnings — preset `per_shift_plus_rest` |
| `M M A A · ·` | 6 | exact fit — preset `ddnnoo` |
| `M A M A M · ·` | 7 | **the only** true 5-on/2-off that works (plus its mirror) |
| `A A A · M M ·` | 7 | 5 on / 2 off with rest split into two singles; keeps shifts in blocks |

**Do not re-derive "just alternate the shifts" as a rule.** A sweep of cycle
lengths 4–12 across 2 and 3 shifts found **55 counterexamples**: alternating
rescues the 7-day 5-2 (4 → 3) and *ruins* the 6-day two-block roster (3 → 4).
Neither blocks nor alternation wins on its own. This was caught only because
the claim was tested before shipping — it had already been written into the UI
copy as advice. Two tests now pin both directions
(`rotation-suggestion.test.ts`, "the crew-day bound against the real
requirement"), and **the note deliberately prescribes no layout**.

## Verification

- `npm run build` clean (**not** `tsc --noEmit` — project references hide
  errors here).
- `npm run test` — **272 passed / 3 failed**, up from 243/3 at session start.
  The 3 are the unowned pre-existing `search-provider.test.tsx` failures.
- `eslint` on `features/schedules` + `features/schedule-rotation` — **0 errors,
  3 warnings**, the same three as before.
- Prettier: touched files only. `schedules/utils.ts` was appended to and
  deliberately **not** run through prettier — it reorders imports and rewraps
  unrelated functions, and it fails `--check` at HEAD anyway (the known
  repo-wide drift).

**Not verified:** nothing in this work has been opened in a browser. The
crew-start editor, the Summary read-back and the `/schedule-rotation` crew line
are markup nobody has loaded. Build and tests being green is not the same
thing.

## Bugs found, and what missed them

- **The note contradicted itself** — headline "needs 4 teams" over arithmetic
  implying 3, with no mention that the pattern's shape was the binding
  constraint. Invisible to typecheck and tests; only a user reading the screen
  found it. Fixed in `4531085`.
- **Summary graded more leniently than the step it summarises** — no
  `startDate`, no `shiftHours`, so three warning families silently vanished
  there. Invisible to tests, which never asserted on Summary's warnings.
- **Two of my own test fixtures were wrong**, and both are easy to rewrite by
  accident: a `[morning, afternoon, night]` crew on a **3-day** cycle wraps
  night into morning across the seam (the forward-rotation test needs a rest
  card); and three crews working three of four cards is 9 crew-days against 12
  cells, so a "no holes" assertion needs the crew count checked against
  `cycleLength × shiftCount` first.

## Still load-bearing from earlier sessions

- **The "understaffed" trap** (09-02): severity is decided by fixability
  (`crewDays >= cycleLength × shiftCount`, or `minimumCrews` when
  `requirement.exact`), never by outcome. Unchanged.
- **The search needs its multiple starts** (09-06). Four tests cover it.
- **`uncoveredCellPenalty` is a computed bound, not a magic number.**
- Any `FormField` whose `name` comes from state needs a `key={…}` (09-03).

## What's left, in priority order

1. **Browser-verify.** Nothing here has been seen. Use the click-list in
   `.claude/handoff/rotation-suggestion.md` §"Open calls" #1, plus: press
   *Suggest*, move a crew in **Crew start days**, confirm the grid rebuilds;
   flip to **Assign manually**, clear a cell, confirm the "edited by hand" note
   appears in the editor *and* on Summary; then `/schedule-rotation` for the
   per-employee crew line.
2. **Add a 7-day two-shift preset** — `M A M A M · ·`, the only true 5-on/2-off
   that 3 crews can cover. **Offered to the user, not yet answered.** Without
   it, the one-pick answer for "two shifts, a real weekend, three teams" does
   not exist and has to be hand-built. Worth pairing with `A A A · M M ·`,
   which is gentler on people (no daily shift flip, so it will not trip the new
   quick-turnaround warning).
3. **Derive real `crew_placements` for the eight rotate seeds.** All carry `[]`,
   so every seeded rotation reads as "set by hand" and **nothing on
   `/schedule-rotation` demonstrates the start-day read-back**. Mechanical: per
   crew in a seed's `day_coverage`, search the `(day_offset, shift_step)` pair
   whose `placementShifts` reproduces that crew's row; emit `[]` where they do
   not all match.
4. **Confirm `healthcare_five_two`'s fourth week** against the original
   write-up. The 09-08 notes transcribed it as **8 cards** (`AA O MM OOO`),
   impossible for a 28-day cycle; built as `AA O MM OO` (7).
5. **Decide whether `master_49` really has no spread-1 placement.** It cannot
   meet the library's ≤1 on-duty flatness invariant — 30 working cards × 7
   crews = 210 crew-days over 49 days, mean 4.29 — so it is recorded as a
   commented exception (`FLATNESS_EXCEPTIONS` in `rotation-suggestion.test.ts`)
   rather than by loosening the rule for all seventeen presets. The naive
   0/7/…/42 stagger gives spread 3; the search reaches 2. Whether 1 is
   reachable at all is unknown.

### Done

- ~~Decide the three scope questions~~ — answered 09-10, see "Where this came
  from".
- ~~Ship crew offsets, guardrails, presets~~ — `7c9cb5a`, 09-10.
- ~~Explain the crew requirement~~ — `4531085`, 09-11.
