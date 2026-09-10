# Rotation crew offsets and guardrails

**Status: built 2026-09-10.** The three scope questions parked here on
2026-09-08 were answered and the work is done. Uncommitted.

## What this was

On 2026-09-08 the user pasted four real-world rotation write-ups and asked
whether the repo's rotate model already implements them. The investigation
found the patterns themselves already worked and four genuine gaps; the
session closed before implementation with three scope questions unanswered.

The four write-ups:

1. **4-crew 2-2-3 (Panama)**, 14-day cycle — "assign Team A to Day 1 of the
   template, Team B to Day 8", pick an effective start date aligned to day one.
2. **4-team / 3-shift forward rotation**, 28-day cycle — week-granular table
   (Team A: M week → A week → N week → O week), assign by "team + start week
   offset", "repeat indefinitely every 28 days".
3. **7-week master rotation**, 7 crews / 49-day cycle — week rows with weekday
   masks, assign a team to a start week.
4. **Healthcare 5/2 rotating**, 4 teams / 28-day cycle, plus three guardrails:
   no quick-turnaround (forward rotation only), weekend equity, skill mix.

## The answers

- **Q1 crew offsets → (a) persist + editable.**
- **Q2 guardrails → delegated to Claude.** Chosen: the quick-turnaround
  warning, surfacing the hidden alignment warnings, and forward rotation as a
  *tie-break only* inside the scorer. **Weekend equity as a scoring term was
  deferred** — only one write-up mentions it, the `weekend-imbalance` warning
  already covers it, and stacking two new scoring terms at once makes a
  regression impossible to attribute.
- **Q3 presets → all three.**

## What was built

### 1. `crew_placements[]` — start days are a real field now

`rotateFieldsSchema` gained `crew_placements: { crew, day_offset, shift_step }[]`
(`schedules/data/schema.ts`). `crew` is the same `team:<id>` / `employee:<id>`
key the suggestion and the step's pool already use.

**`day_coverage` is still the source of truth.** Placements are a *generator
record* stored beside it, which is what the 2026-09-06 session's removal of
offsets requires — free cell editing can produce a roster no pair of offsets
describes.

**Staleness is re-derived, never flagged.** `dayCoverageMatchesPlacements`
(`rotation-crews.ts`) regenerates cells from the placements and compares. A
`stale` boolean would have to be cleared on every path that touches a cell,
and the one path that forgets makes the record lie. Regenerating cannot drift.
False means somebody hand-edited: every screen then shows the matrix and says
the start days no longer describe it, and **nothing re-applies them**.

New in `rotation-crews.ts`: `cellsFromCrewPlacements` (the stored shape in,
cells out — `cellsFromPlacements` now delegates to it), `crewPlacementsToStored`,
`dayCoverageMatchesPlacements`, `shiftHoursById`.

**Where it surfaces:**

- **Assign to step** — `CrewStartEditor` in
  `components/schedule-form/rotation-crew-starts.tsx`. One row per crew: a
  "starts on day N · week M" select and a shift-track select. The shift-track
  options are **labelled by the shift the crew actually opens on**, never by
  the stored step number, which is a transposition through the shift list and
  means nothing to anyone building a roster. Changing either regenerates the
  whole matrix from every crew's offsets via `applyPlacements` — regenerated,
  not patched, so nothing survives from the previous arrangement to
  double-book a cell.
- **Summary step** — `CrewStartSummary`, read-only. Reads each crew's opening
  shift off the *stored matrix* rather than recomputing it, so it stays honest
  after a hand edit.
- **`/schedule-rotation`** — `RotationRow` gained `crewKey`/`crewLabel`/
  `startDay`; the table shows "Team B · starts day 8 · week 2" under the
  employee name. `startDay` is only filled in when the placements still
  describe the matrix (checked once per table in `buildRotation`, not per row).
  A crew that is a single picked employee shows no label — repeating their
  name under their name says nothing.

Both Radix `Select`s carry the `if (!value) return` guard from the
`radix-select-bubble-select-wipes-programmatic-value` skill. Every value here
is programmatically set (Suggest writes them), which is exactly the trigger.

### 2. Quick-turnaround guardrail

`findQuickTurnarounds` in `rotation-suggestion.ts`, plus a `quick-turnaround`
warning code and two new `AnalysisOptions`: `shiftHours` and `minRestHours`
(default 11, the EU Working Time Directive daily rest).

**Measured in hours, not list positions — this is the load-bearing decision.**
Shifts are ordered by start time, so Night → Morning steps one place *forward*
through the list while being the textbook quick turnaround: off at 06:00, back
on at 06:00. Any rule written on `orderedShiftIds` indices waves through the
one transition it exists to catch. `shiftHoursById` supplies real clock spans,
pushing an overnight shift's end past 1440 so the arithmetic
(`1440 + nextStart − prevEnd`) lands on zero instead of going negative.

Wraps the cycle seam, because the cycle repeats. Uses the tightest reading
(latest finish into earliest start) where a hand edit has double-booked a day.
**One warning line, not one per occurrence** — a list of near-identical
paragraphs is how this panel stopped being read on 2026-09-02.

Without `shiftHours` the check does nothing at all. Guessing would be worse
than staying quiet, and it keeps `crewRequirement`'s probes — which
deliberately pass no options — scoring exactly as before.

### 3. Forward rotation in the scorer, as a tie-break

`QUICK_TURNAROUND_TIEBREAK = 1e-3` per offending transition, an order of
magnitude above the spacing tie-break and far below anything the coverage
score reaches. A 28-day roster with four crews tops out near 0.1, smaller than
one misplaced crew-day's effect on the balance terms. **Gated on `shiftHours`
being supplied**, so every pre-existing test scores identically by
construction — no rebaselining was needed, and none was done.

Threaded as an optional `PlacementContext` through `scorePlacements` →
`localImprove` / `greedyPlacement` / `bestDayOffsetsFor` / `choosePlacement`.

### 4. Alignment warnings are visible

`rotation-coverage-panel.tsx`'s filter now allows `weekday-anchor` and
`weekday-drift` through alongside `uncovered-shift` (a named
`SHOWN_INFO_CODES` set). That anchor warning *is* the user's "align the
effective start date with day one" rule, and it had been computed and thrown
away.

`schedule-summary.tsx` now parses `start_date` and passes `startDate` **and**
`shiftHours` into `analyzeDayCoverage`. It was passing neither, so weekday,
weekend and rest warnings were all silently absent on Summary while showing on
Assign-to. A summary that grades more leniently than the screen it summarises
is worse than no summary.

### 5. Three presets

In `data/rotation-presets.ts`, all under "Named systems":

- `weekly_forward_28` — `7×M 7×A 7×N 7×off` (minShifts 3, 4 crews).
- `master_49` — `MMMMM OO / OO MMMMM / AAAAA OO / OO AAAAA / NNNNN OO /
  OO NNNNN / OOOOOOO` (minShifts 3, 7 crews).
- `healthcare_five_two` — `MMMMM OO / OO AAAAA / NNN OO NN / AA O MM OO`
  (minShifts 3, 4 crews).

**Two things to know about these:**

- **The healthcare write-up's last week was transcribed as 8 cards**
  (`AA O MM OOO`) in the 09-08 notes, which cannot be right for a 28-day /
  4-week cycle. Built as `AA O MM OO` (7). Worth confirming against the
  original source.
- **`master_49` cannot meet the preset library's flatness invariant**, and it
  is not the search's fault. Thirty working cards across seven crews is 210
  crew-days over a 49-day cycle — mean 4.29, so some day *must* differ from
  some other. The naive 0/7/…/42 stagger gives spread 3; the search gets it to
  2. Recorded as an explicit, commented exception (`FLATNESS_EXCEPTIONS` in
  `rotation-suggestion.test.ts`) rather than by loosening the rule for all
  fifteen presets. **If a spread-1 placement does exist, the search is not
  finding it** — that is the open question on this preset.

## Deliberately not built

**Skill-mix assignment** (healthcare guardrail 3). Employees carry `position`
and teams carry `employee_ids`, so the data exists — but this is about how
teams are *composed*, not how they rotate. Belongs to the teams feature.

**Weekend equity as a scoring term.** See Q2 above.

## No migration needed

`crew_placements` is `.default([])`, so a stored schedule without the key gets
an empty array on load and simply reports "set by hand". **`SEED_VERSION` was
not bumped** and does not need to be.

The eight rotate seeds carry `crew_placements: []` — their matrices were
hand-authored and the real offsets behind them were never recorded. **This is
the one visible gap:** no seeded rotation demonstrates the start-day read-back,
so browser-verifying that part means building a rotation in the form first.
Deriving each seed's true offsets by searching for the `(day_offset,
shift_step)` pair per crew that reproduces its stored matrix is mechanical and
would fix this.

## Verification

- `npm run build` clean (**not** `tsc --noEmit` — project references hide
  errors here).
- `npm run test` — **267 passed / 3 failed**, up from 243/3. The 3 are the
  unowned pre-existing `search-provider.test.tsx` failures.
- `eslint` on `features/schedules` + `features/schedule-rotation` — **0 errors,
  3 warnings**, the same three that were there before.
- `prettier` — only touched files were formatted. `schedules/utils.ts` was
  appended to and deliberately **not** run through prettier, because doing so
  reorders imports and rewraps unrelated functions (the known repo-wide drift;
  it fails `--check` at HEAD too).
- **Not browser-verified.** No browser tooling in this session.

Two of the three new test failures during development were bad fixtures of
mine, worth knowing because both are easy to write again:

- A `[morning, afternoon, night]` crew on a **3-day** cycle wraps night
  straight back into morning. The forward-rotation test needs a rest card.
- Three crews working three of four cards is nine crew-days against twelve
  cells. Any "no holes" assertion needs the crew count checked against
  `cycleLength × shiftCount` first — the 09-02 arithmetic trap, again.

## Still load-bearing from earlier sessions

- **The "understaffed" trap** (09-02): severity is decided by fixability
  (`crewDays >= cycleLength × shiftCount`, or `minimumCrews` when
  `requirement.exact`), never by outcome. Unchanged by this work.
- **The search needs its multiple starts** (09-06). Four tests cover it.
- **`uncoveredCellPenalty` is a computed bound, not a magic number.**
- Any `FormField` whose `name` comes from state needs a `key={…}` (09-03).

## What to do next

1. **Browser-verify.** The click-list in
   `.claude/handoff/rotation-suggestion.md` is still outstanding and the repo
   has now gone five sessions without a browser check. Add to it: press
   *Suggest*, then move a crew in the new **Crew start days** editor and check
   the grid rebuilds; then flip to **Assign manually**, clear a cell, and check
   the "edited by hand" note appears in the editor *and* on Summary. Then
   `/schedule-rotation` for the per-employee crew line.
2. **Derive real `crew_placements` for the seeds** (see "No migration needed").
3. **Confirm the healthcare preset's fourth week** against the original
   write-up.
4. Decide whether `master_49` really has no spread-1 placement.
