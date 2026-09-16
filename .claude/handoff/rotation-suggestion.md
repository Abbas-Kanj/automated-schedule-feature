# Rotation suggestion — computing who covers what, when

Built 2026-09-02, corrected 2026-09-03, **reworked 2026-09-06**. Turns the
rotate schedule's "Assign to" step from a hand-filled grid into a **suggestion
+ grading** step: pick the crews, press one button, get an assignment that
staffs every selected shift every day, and see what is wrong with the result
either way.

> **2026-09-06 in one line:** the pattern used to decide *which shifts run each
> day*, which meant an all-Morning 5-2 pattern could never staff Night however
> many crews you added. The pattern is now a **template** (one crew's journey),
> `shift_ids` decides what runs, and a new stored **(cycle day × shift) → crews
> matrix** records who covers it. Details throughout — this file was rewritten,
> not appended to.

> **Where `schedule-assign-to-fields.tsx` is mounted (current, 2026-09-16,
> uncommitted):** **only** the "Assign crews" dialog on the rotating Work
> schedule screen. The wizard's "Work rotation"/"Work fixed" steps are gone,
> and fixed schedules no longer use this component at all. The dialog now
> puts Start & End before Suggest and gates everything on valid dates, labels
> columns/cards with real dates, and shows the Employees table instead of the
> crew table; the Crew start days editor is deleted. The suggestion and
> coverage mechanics below are unchanged. Detail:
> `.claude/handoff/schedule-wizard-assign-steps.md`.

Companion to `.claude/handoff/schedule-rotation-screen.md`, which covers the
screen those assignments drive.

## The model (2026-09-06)

A rotate schedule owns one shared `pattern[]` of cycle cards. **That pattern
describes one crew's journey** — "Morning, Morning, off, Afternoon…" — and
nothing more. What has to run each day is the schedule's own `shift_ids`, and
the rule the feature now exists to keep is: **every selected shift is covered
on every day of the cycle.**

Two numbers place a crew against the template:

| | |
|---|---|
| `dayOffset` | which card it stands on: `pattern[(d + dayOffset) mod L]`. The old offset, unchanged. |
| `shiftStep` | **new** — how far its journey is *transposed* through the shift list, ordered by start time. |

`shiftStep` is the whole unlock. Without it every crew visits every card, so if
every card says Morning then Morning is all anybody ever works. With it, two
crews at steps 0 and 1 cover Morning *and* Night every weekday off one
all-Morning 5-2 pattern.

### What is stored is the resolved matrix, not the placements

`day_coverage` on the rotate branch: a **sparse list of cells**, each
`{ day, shift_id, employee_ids, team_ids }`, `day` being the 0-based cycle day.
Only cells somebody is on are stored, so "no cell" and "empty cell" mean the
same thing everywhere.

The reason it is the matrix and not the two offsets: **the manual grid edits
single cells freely** (the user's explicit choice — see "Decisions taken"),
and no pair of offsets can express an arbitrary cell edit. So the offsets now
live *only inside the search*, as the thing that generates the matrix.

### Decisions taken 2026-09-06, and by whom

All four came from the user directly; none is an inferred default.

| | |
|---|---|
| Pattern card | Unchanged — `shift_id` or `is_off`. It is one crew's journey. |
| Other crews' shifts | Same card, **transposed** by the crew's own shift step. |
| Shift rotation order | By shift **start time**, earliest first. No new ordering UI. |
| Short coverage | **Warn, don't block.** Red `0` in the grid + a named warning; Next always advances. |
| Manual grid | **Day → one row per shift, free cell edit.** |

## The algorithm — `src/features/schedules/rotation-suggestion.ts`

Pure, no React, no stores, no schema. Two entry points that meet in the middle:

- `suggestRotationCoverage(slots, crews, orderedShiftIds, options)` — searches
  placements and returns them plus a grade. The caller materialises them into
  cells.
- `analyzeDayCoverage(crews, orderedShiftIds, cycleLength, options)` — grades
  the **matrix**. The panel calls this on live form values, so hand edits are
  graded honestly rather than being re-derived from offsets that no longer
  describe them. This split is *required* by free cell editing, not a
  preference.

`placementShifts` / `placementsToCoverageCrews` are the shared primitives
between the two halves.

**Cost.** A dominating penalty per unstaffed `(day, shift)` cell, then variance
of per-cell crew counts, then variance of crews-on-duty per day, plus a tiny
even-spacing tie-break on day offsets. `emptyDayPenalty` from 09-02 is **gone**,
subsumed: a day with nobody on it has all N shifts uncovered, so it is already
the most expensive thing on the board.

**Search — and this needed more than the first cut had.** Seeding only
round-robin shift steps *loses to plain even spacing* on DuPont and DDNNOO,
because those patterns already spell out their own day/night alternation and
want every step at 0. Four tests caught it. The search is now multi-start:

1. even-spaced days + **all-zero** steps,
2. even-spaced days + **round-robin** steps,
3. a **greedy construction** — place crews one at a time, each into the
   `(day, step)` that best completes what is already down,
4. the exhaustive day-offset pass, run once **per step seed**.

Each start is then polished by `localImprove`, and the best result wins.
`localImprove` has three move types now: relocate a day offset, change a shift
step, swap two crews' whole placements.

Two free symmetries let crew 0 be pinned to `(0, 0)`: rotating every day offset
rotates the coverage array without changing it, and rotating every shift step
cyclically permutes which shift is which — every term of the score is a
symmetric sum over shifts. `EXHAUSTIVE_LIMIT = 100_000` is now a budget on the
**total** candidates scored (`combinations × stepSeeds`), so adding the second
step seed halves how long a cycle stays exhaustive rather than doubling work.

**Duplicate day offsets are now allowed.** The single-offset model forbade them;
that ruled out two crews sharing a rest rhythm on different shifts, which is a
perfectly ordinary roster. The score decides instead.

## Findings worth not re-deriving

**1. "Fewer crews than cycle days = understaffed" is wrong, and it fires on
correct rosters.** The first cut coded that rule and it flagged a textbook
4-crew Panama (14 cards) as broken. The deeper mistake: **not every roster wants
24/7 coverage** — an office 5-2 leaves two days empty *by design*.

Severity is decided by **fixability**, not by outcome:

- `error` — nothing to work with (no pattern, or nobody on it).
- `warning` — a different assignment would genuinely help.
- `info` — a property of the pattern + crew count that no assignment changes.

The structural test is now one line: **`crewDays >= cycleLength × shiftCount`**.
Below it, the grid cannot be filled by anybody, and the warning says so with the
remedy ("N crews on this pattern would cover every shift every day"). Named
regression test for the Panama case.

**2. The 28-day day/night flip *is* coverable by 4 crews — a test assumed
otherwise and the algorithm was right.** Even spacing (0/3/7/10) puts all four
crews in the same half of the cycle on day one, leaving nights empty. The
coverage search straddles the halves. Kept as its own test.

**3. Balance will buy itself an empty cell if you let it (found 2026-09-03,
still true).** A 5-2 week with two crews once came back with a day the plant
was shut, traded for a smoother shift count. An unstaffed cell is
**categorically** worse than a lumpy one, so it is priced above everything else
the score can reach rather than competing with it.

The size is a **bound, not a magic number**: every squared term has both sides
in `[0, crewCount]`, so `cycleLength × shiftCount × crewCount²` (balance) plus
`cycleLength × crewCount²` (on-duty) plus the spacing ceiling exceeds any
reachable total.

**This does not reintroduce finding 1's trap, and the argument is the same
one**: when cells cannot be filled, *every* candidate pays the same **minimum**
number of penalties, and a constant added to every candidate cannot change
which is smallest — while a candidate that leaves *more* cells empty than it had
to still pays more. Named tests on both halves.

**4. (2026-09-06) An arithmetic trap in "5-2 with 2 crews".** The
implementation plan claimed 2 crews on a 5-2 with two shifts should show no red
`0`. Wrong: 2 × 5 = 10 crew-days for 7 × 2 = 14 cells, so **4 cells must stay
empty**. The correct claim is that it fills 10 *distinct* cells (never doubling
up while another sits bare) and reports the rest as `info`. Use **4 crews** for
a "no red 0" check. Test: "fills as many cells as the crew-days allow".

## Shift order — `orderShiftIdsByStart`

Lives in `rotation-crews.ts`. Earliest `from_time` across a shift's enabled
days, via `lib/time.ts#toMinutes`; ties break on name so the order is stable
across renders and reloads. A shift with **no enabled day sorts last**, so an
unconfigured shift does not silently become the head of the rotation. Ids with
no matching shift are kept, at the end — dropping them would quietly shrink the
rotation.

## Removed 2026-09-06 — `crew_shift_id`, and the crew fields on a pattern card

`rotatePatternEntrySchema` lost `employee_ids`, `team_ids` **and**
`crew_shift_id`. All three are superseded by `day_coverage`:

- the crew arrays because the roster is the matrix now;
- `crew_shift_id` (the "Always Night" pin) because the matrix expresses pinning
  directly — it was only ever a workaround for a roster the offset model could
  not represent.

`applyCrewShift` in `schedule-rotation/utils.ts` went with it.

This also killed the pre-existing drag bug where `usePatternReorder` moved a
card's crew but *not* its `crew_shift_id`, leaving a pin behind on the old
index.

**No migration.** Removed keys are stripped by the non-strict zod object, so a
saved rotate schedule still loads — with an empty roster, re-suggestable in one
click. This is a no-backend demo app with version-stamped seeds; the project has
precedent (`policy_type`, `official-holidays`).

**Known boundary that remains:** crews still cannot have *different rest
patterns* from one another. One shared mask, one `(dayOffset, shiftStep)` each.
Matches the user's own pseudo-code, so not treated as a gap.

## Presets — `src/features/schedules/data/rotation-presets.ts`

**Unchanged by the rework**, which is a small vindication of the shape: a preset
is only a card list, each entry an **index into the schedule's own `shift_ids`**
or `null` for rest. 14 systems in three groups (Office & simple / Continuous
coverage / Named systems).

Rendered in `PatternBuilder`'s "Create pattern" card, **`pattern_shifts` only** —
`custom_shifts` rebuilds from `shift_repeat` and would clobber a preset.
Applying one writes `cycle_length` as `{ unit: 'custom_days', days: N }` first,
then `replace()`s the cards. It no longer carries crew across by position
(`crewAt` deleted) — there is no crew on a card any more.

> `custom_days` is deliberate: 14 and 28 are not whole week/month units, and it
> also sidesteps the hardcoded-`6` week readout (open call #2 in the companion
> file, still unfixed — this path just never reaches it).

Test asserting **every preset at its own `suggestedCrews` stays flat within one
crew** — the broadest guard that the search generalises.

## The "Assign to" step — `schedule-assign-to-fields.tsx`

> Mounted in the **"Assign crews" dialog** on `/schedule-rotation` since
> 2026-09-12 (a standalone page for one day before that; a wizard step before
> that) — see the callout at the top of this file. Everything below still
> describes the component itself accurately; read "the step" as "wherever
> this component is mounted."

Two cards. **Suggesting is the default path; hand-assignment is an escape hatch
behind a toggle.**

**Card 1 — "Who is on this rotation"**

- Teams/Employees `ToggleButton` pair, one picker, then "Suggest assignment".
- The pool is **local state, not a form field**: the union of what is assigned
  *is* the pool (now derived from `day_coverage` via `crewKeysFromDayCoverage`),
  so it round-trips a saved schedule with no schema change. The component
  unmounts when the wizard leaves the step, so returning re-derives it.
- Suggest does **one whole-field `setValue('day_coverage', …)`**, which makes
  the old "leftover crew silently double-books" bug structurally impossible
  rather than guarded against.
- **Coverage panel** below it — see next section.

**Card 2 — "Assign manually"**, gated by a `Switch`, off by default.

- One `Card` per cycle day, and inside it **one row per selected shift**, each
  with its own crew `MultiSelect`. An unstaffed shift is a visibly empty field.
- **Free cell edit**: putting a crew on a cell moves nothing else. That is the
  whole reason the matrix is stored.
- Written straight through `setValue`, **not** a `FormField` per cell — the
  stored array is sparse, so a cell has no stable index to register a controller
  against, and clearing one would renumber every field name after it. Emptying a
  picker drops the cell entirely.
- Only the crew kind picked above is offered, never both.
- A 28-day × 3-shift cycle is 84 pickers. Acceptable: manual mode is opt-in.

### The A-Z first-letter filter (2026-09-12)

Both pickers are `components/multi-select/filterable-multi-select.tsx` — an
A-Z strip (built from the shared `ToggleButton`) over the existing
`MultiSelect`, for picking people out of a directory too long to scroll.

- **It narrows `options` only.** react-select takes `value` separately, so a
  name already picked keeps its chip while a letter that excludes it is
  active. Without that the filter would silently unpick people; there is a
  test named for it.
- Letters no option starts with render **disabled**, so the strip doubles as a
  readout of what the directory holds.
- `onLetterChange` reports the active letter, so this can become a server-side
  query once the options come from an API — which is why it was built now.
- ⚠️ In tests, `getByRole('button', { name: 'A' })` also matches **"All"**.
  Use `exact: true`.

`getStepFields` returns `['pattern', 'day_coverage']` — well-formedness only.
**Nothing here blocks Next**, by decision: whether a hole is fixable depends on
the crew count, not the data.

### "Next" (now "Save") accepts the step (2026-09-03, still true)

`commitPendingSuggestion` compares the pool against the crews actually on the
matrix and re-runs the suggestion only when they differ, so straight after
pressing the button it is a no-op. It covers the two half-taken paths: picking a
pool and never pressing Suggest, and changing the pool after pressing it.
**Manual mode is skipped entirely** — re-running the search over hand-placed
crew would destroy the exact work the toggle exists to allow.

Plumbed as a `commitRef` filled from an effect with **no dependency list** (the
callback closes over live pool state). **Since 2026-09-11** it's called from
the assign page's "Save assignment" button, before reading `form.getValues()`
— the exact same ordering `handleNext` used before `form.trigger`, just a
different caller. The wizard no longer has an "assign-to" step to fire it
from at all.

### ⚠️ Flipping Teams/Employees used to copy ids into the wrong field

Found 2026-09-03. Toggling the crew kind changed a `FormField`'s `name` while
react-hook-form still held the old field's value, so `team_ids` ended up holding
employee ids. **Any control whose field is computed from state needs a `key`.**
Carried onto the new cell pickers as `key={crewKind}`.

### The warning list is now rendered (changed 2026-09-06)

The 09-03 note said warnings were computed but not displayed, because they
emitted one near-identical line per shift **without naming which shift**, and
told the next session to *rewrite the messages before re-displaying them*.

**That rewrite is done.** Warnings name the shift (`shiftLabels` option on
`analyzeDayCoverage`), list the affected days, and are rendered under the grid
with severity styling. They have to be visible now: an unstaffed shift is not a
validation error by decision, so the panel is the only place it is reported.

`overstaffed` was dropped — it meant nothing under a free matrix. A new
**`crew-double-booked`** warning was added: free cell editing makes "one crew on
two shifts the same day" one click away, and it is silent everywhere else.

### The coverage panel — `rotation-coverage-panel.tsx`

Rewritten. **Two grids**, because they answer different questions:

- **rows = shifts**, columns = cycle days, cells = crew count, red `0` when
  unstaffed, plus an "On duty" footer. This is the rule the feature keeps.
- **rows = crews** below it — each crew's own journey, so you can see somebody
  hopping shifts. Two shifts on one day render as `M/N` in destructive red.

Then the warning list. Reused verbatim by the Summary step.

## The Summary read-back

`AssignToSummary` repeats **the same coverage grid the step ends on**, reading
`day_coverage`. The 09-03 "starting positions" list is gone — starting positions
are not a thing any more.

The **calendar preview is deliberately unchanged**: it walks the *pattern*,
which is one crew's journey, so it shows one shift a day even when the schedule
runs three. A line above it now says so and points at the grid.

## Seed — the third rotation

`sched-panama-223` "Plant Coverage (2-2-3)": 14-day mask, 4 crews. Read it on the
**Daily** tab.

It is now the clearest demonstration of the whole rework: **every working card
names Morning, and Night is staffed on all fourteen days.** Under the old model
this roster needed four hand-set `crew_shift_id` pins; now the suggestion moves
two crews onto nights by itself. Amir and Carla hold mornings, Bilal and Dana
nights, interleaved so no day loses cover.

All three seeds' matrices were hand-computed and are locked by
`scenario.test.ts` ("staffs every selected shift on every day of every seeded
cycle") — which is what verified the arithmetic.

**`SEED_VERSION` bumped to `'2026-09-06-day-coverage-matrix'`** — required, or a
browser that has already opened the app keeps its cached `schedules` blob.

## Files (2026-09-06 pass)

**Rewritten:** `schedules/rotation-suggestion.ts`, `schedules/rotation-crews.ts`,
`schedule-form/rotation-coverage-panel.tsx`,
`schedule-form/schedule-assign-to-fields.tsx` (+ both tests)

**New:** `schedules/rotation-crews.test.ts`

**Changed:** `schedules/data/schema.ts` (pattern slimmed, `day_coverage` +
its three well-formedness refines), `schedules/data/schedules.ts` (all three
seeds), `schedule-form/{pattern-builder,schedule-summary,schedule-form}.tsx`
(+ `schedule-form.test.tsx`), `schedule-rotation/utils.ts` (+ `utils.test.ts`,
`scenario.test.ts`), `lib/seed-store.ts`

## ⚠️ Cold-cache "Invalid hook call" — `optimizeDeps.include`

vitest's browser mode optimizing a dep **mid-run** reloads the page and briefly
resolves a second React — `Invalid hook call` across the file, only on a **cold**
`node_modules/.vite`. Same signature as the existing `resolve.dedupe` comment,
which makes it easy to dismiss as already handled.

```ts
optimizeDeps: { include: ['@radix-ui/react-switch', '@radix-ui/react-popover'] },
```

Hit twice (switch on 09-02, popover on 09-03, exactly as predicted). **Did not
recur on 2026-09-06** — the new UI reuses primitives already in the list.
**Anything a component test mounts that is not already reached from
`src/main.tsx` belongs there.**

## Status — 2026-09-12

> Supersedes every earlier Status block in this file. The mechanics described
> above (algorithm, coverage panel, warnings) are unchanged since 2026-09-06;
> only where the component is mounted, its pickers, and the numbers have moved.

- `npm run build` **clean**. `npm run test` — **362 passed / 0 failed**
  (273/3 at the end of 09-11; 243/3 at 09-06).
  **The three `search-provider.test.tsx` failures are fixed**, not still
  outstanding — they were never flaky, and any older line here calling them
  "pre-existing, unowned" is stale.
- `npx eslint` — clean on every touched file; repo baseline of 11 errors /
  3 warnings is in five files this work does not touch.
- `schedule-assign-to-fields.tsx` changed only to swap both pickers to
  `FilterableMultiSelect`. The suggestion, manual grid and coverage panel are
  untouched.
- The seam tests live in
  `schedule-rotation/components/assign-crews-dialog.test.tsx` (moved with the
  page→dialog change), plus three new dialog-level tests.
- **BROWSER-VERIFIED 2026-09-12** — first time for this area. Driven with
  Playwright against the real dev server. What was confirmed and what was
  *not* is listed in `.claude/handoff/schedule-rotation-screen.md`'s Status;
  the short version is that the dialog, the A-Z strip and the coverage grid
  all render and behave, but **the suggestion click-path below was not walked
  end-to-end** — see open call #1.
- The 09-12 work and the 2026-09-13 wizard changes to this component (the
  new props) are **committed and pushed** (2026-09-15) — see
  `.claude/handoff/schedule-wizard-assign-steps.md`.

## Open calls / follow-ups

1. **Browser-verify the *suggestion* path.** Partly done 2026-09-12: the
   dialog opens, the coverage grid and warning list render, the manual grid
   renders one picker per shift per day, and the A-Z strip works. **Not
   walked**: the motivating correctness case. Do that next — in the wizard
   (Basics → Shifts, select **Morning + Night** → Pattern, preset **5-2**,
   every card Morning → **Assign to**, pick **4** teams or employees → **Work
   rotation** → *Suggest*), or the same from `/schedule-rotation` → **Assign
   crews** on a saved schedule: the shift rows must read `1` for Morning *and* Night on
   all seven days, no red `0`. Before the 09-06 rework Night was `0` on all
   seven. Then preset **2-2-3 Panama**, 2 shifts, 4 crews → one crew on each
   shift all 14 days. Then flip **Assign manually** on and clear a cell → a
   red `0` appears *and a warning naming that shift*, and **Save still
   succeeds**. Under-crew it (3 shifts, 2 crews) → the warning must read
   structural ("N crews would cover every shift every day"), not as something
   done wrong. Then edit **Start & End** and Save → both the roster and the
   dates persist; re-open → "N crews assigned" and the roster loads back.
   Then check the wizard Summary lists the picked crews and "N crews
   assigned.", and the View page shows the roster read-only.
   Also: toggling Teams ⇄ Employees with the manual grid open must not put
   employee names in a team field.
   **Note**: creating a new rotate schedule is also the only way to see the
   dialog's "open on an unassigned schedule" default — every seed is staffed.
2. **The manual grid is `L × N` pickers** — 84 for a 28-day 3-shift cycle. Fine
   in principle (opt-in, behind a switch) but unmeasured. If it drags, the fix
   is probably rendering only the day currently expanded.
3. **`getScheduleTotalHours` still reads the pattern**, not the matrix — it
   reports one crew's average day, which is arguably right, but it is now a
   different question from "what does this schedule cost". Left alone
   deliberately; revisit if anyone reads it as a total.
4. **The rotation screen's cycle legend decodes the *pattern's* letters**, so on
   a schedule where crews are transposed onto other shifts the legend and the
   rows disagree. Same shape as the old `crew_shift_id` note. Not wrong, but
   potentially confusing.
5. **The Daily tab is withheld when one card is not one real day** —
   `getScheduleCycleLength(schedule) !== pattern.length`, the weekly-`shift_repeat`
   case (open call #4 in the companion file). Guards the disagreement rather
   than resolving it.
6. **`analyzeDayCoverage` runs on every relevant form change.** Memoised and
   cheap at these sizes, but not incremental. The *search* is now multi-start
   and strictly more expensive than 09-03's — still instant on the presets,
   worth profiling before assuming a 56-day/8-crew roster is free.
7. **Crews cannot have different rest masks** (see the boundary note above).
   Would need independent pattern groups; deliberately out of scope.
