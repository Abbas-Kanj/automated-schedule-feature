# The rotation algorithm

How a **rotate** schedule decides who works which shift on which day, what it
guarantees, and where it deliberately stops.

Every worked number in this document is computed by
[`src/features/schedules/doc-examples.test.ts`](../src/features/schedules/doc-examples.test.ts),
so the document fails the build rather than drifting.

**Source files**

| File | Role |
| --- | --- |
| `src/features/schedules/rotation-suggestion.ts` | The algorithm. Schema-free and store-free. |
| `src/features/schedules/rotation-crews.ts` | Bridges the algorithm to stored data and owns shift ordering. |
| `src/features/schedules/data/schema.ts` | What a rotate schedule may be; the cross-field rules. |
| `src/features/schedules/data/rotation-presets.ts` | The 17 ready-made patterns. |
| `src/features/schedules/components/schedule-form/schedule-assign-to-fields.tsx` | The "Assign to" step that drives it. |

---

## 1. The model

Three things, and keeping them separate is what makes the feature work.

**The shifts (`shift_ids`)** — what has to run. *Every selected shift is meant
to be covered on every day of the cycle.* This is the requirement.

**The pattern (`pattern[]`)** — a **template**, not a timetable. It describes
**one crew's journey** through the cycle: "Morning, Morning, off, Afternoon, …".
It says nothing about what runs on a given day.

**The roster (`day_coverage[]`)** — the resolved answer: a sparse
`(cycle day × shift) → crews` matrix. This is the source of truth, and what
every screen reads.

Two numbers place a crew against the template:

- **`dayOffset`** — which card the crew stands on at day 0, so its card on day
  `d` is `pattern[(d + dayOffset) mod L]`.
- **`shiftStep`** — how far its journey is *transposed* through the shift list,
  ordered by **start time**. A crew on a Morning card with `shiftStep` 1 works
  the next shift along instead.

### Why `shiftStep` exists

Without it, the pattern would decide which shifts run, and that is wrong. Take a
5-on/2-off pattern where every working card says *Morning*, with Morning and
Night both selected. Every crew visits every card, and every card says Morning —
so **Night could never be staffed, however many crews you added.**

With `shiftStep`, two crews on the same rest rhythm and different steps cover
both shifts off the very same pattern. Four crews on that all-Morning 5-2 staff
Morning *and* Night on all seven days, with nothing left open.

```
pattern (template):   M  M  M  M  M  ·  ·        (M = morning card, · = rest)

crew A  dayOffset 0, shiftStep 0 →  M  M  M  M  M  ·  ·
crew B  dayOffset 0, shiftStep 1 →  N  N  N  N  N  ·  ·
crew C  dayOffset 5, shiftStep 0 →  ·  ·  M  M  M  M  M
crew D  dayOffset 5, shiftStep 1 →  ·  ·  N  N  N  N  N

coverage              Morning:  1  1  2  2  2  1  1
                      Night:    1  1  2  2  2  1  1     ← no zeroes
```

### Why the matrix is what gets stored

The placements above are *not* the stored form. The "Assign to" step's manual
grid edits **any single cell freely**, and no pair of offsets can express an
arbitrary cell edit. So the resolved matrix is stored and the offsets are kept
beside it, as a record of how it was generated:

```
day_coverage[]     the roster                      — source of truth
crew_placements[]  "Team B starts on week 2"       — how it was generated
```

`crew_placements` is deliberately **not a second source of truth**. Whether it
still describes the cells is **re-derived** — regenerate from the offsets and
compare (`dayCoverageMatchesPlacements`) — never tracked by a flag. A flag has
to be cleared on every path that touches a cell, and the one path that forgets
makes the record lie. After a hand edit the screens show the matrix and say the
start days no longer describe it; **nothing re-applies them.**

---

## 2. Sizing the crew pool

`crewRequirement` answers "how many crews does this pattern need?" **before**
anything is placed, because the coverage panel can only report a shortfall once
crews are down — by which time the choice has been made.

The obvious sum is wrong, and being wrong in a specific way that has to be
explained rather than hidden. For a 5-2 pattern over 2 shifts:

| | |
| --- | --- |
| Cells to fill | 7 days × 2 shifts = **14** |
| Days one crew works | **5** |
| Crew-days ÷ cells | ⌈14 ÷ 5⌉ = **3** ← what anyone works out in their head |
| **Crews actually needed** | **4** |

The gap is real. Every crew walks the *same cards*, just started on a different
day, so two crews on duty together can land on the same shift and leave the
other empty. Three crews on that pattern leave **2 cells** open however they are
placed. The UI note names the gap and attributes it to the pattern's shape,
because the bare number looks like it can only be fixed by hiring — when in fact
editing the pattern can lower it.

So the requirement is found **by placing**, not by counting: start at a true
counting lower bound and run the real search for one more crew at a time until
it covers everything (`REQUIREMENT_PROBE_LIMIT` = 4 probes). The number then
means exactly what the user cares about — *the smallest pool "Suggest
assignment" can actually fully cover with* — instead of a bound the button then
fails to reach. If the budget runs out, `exact: false` says so and the UI stops
promising full coverage.

---

## 3. Scoring

Lower is better. The terms are **strictly ordered by magnitude**, so a cheaper
concern can never outbid a dearer one.

| Rank | Term | Weight |
| --- | --- | --- |
| 1 | Unstaffed `(day, shift)` cells | `uncoveredCellPenalty` — a computed bound, above everything below combined |
| 2 | Per-cell crew counts, squared deviation from the mean | 1 |
| 3 | Crews on duty per day, squared deviation from the mean | 1 |
| 4 | Distance from evenly spaced day offsets | `1e-4` |
| 5 | Quick turnarounds (only when shift clock times are supplied) | `1e-3` |

**The cell penalty is a bound, not a magic number.** It is the largest total the
rest of the score can reach, so one avoidable hole always costs more than any
amount of lumpiness. Before this existed the search happily traded a whole
shift away for a flatter head count.

**Holes nobody can fill stay harmless.** When there are simply not enough
crew-days, *every* candidate pays the same minimum number of penalties, and a
constant added to every candidate cannot change which one is smallest. The
penalty only bites when a hole was avoidable — exactly when it should.

**Rest is a tie-break, never a trade.** Forward rotation and minimum rest sit at
`1e-3`: they decide between rosters that are otherwise equally covered, and
never buy a kinder rota at the cost of an unstaffed shift. The term is only
added when the caller supplies real clock times, so every scoring path without
them is byte-identical to what it was before rest existed.

---

## 4. The search

The space is every assignment of crews to `(dayOffset, shiftStep)` pairs. Two
free symmetries shrink it: rotating every day offset by the same amount rotates
the coverage array without changing it, and rotating every shift step cyclically
permutes which shift is which. Every term of the score is a symmetric sum over
shifts, so it is invariant under both — which lets crew 0 be pinned to offset 0.

**Four kinds of start, then hill-climb each**, keeping the best:

1. Even spacing × **all-zero** shift steps.
2. Even spacing × **round-robin** shift steps.
3. **Greedy** construction — place crews one at a time, each into the pair that
   best completes what is already down.
4. **Exhaustive** over day offsets, once per shift-step seed, when the candidate
   count fits the budget (`EXHAUSTIVE_LIMIT` = 100,000 — DuPont at 28 cards and
   4 crews is 2,925; 28 cards and 6 crews is 80,730).

> **Both shift-step seeds are load-bearing — do not simplify this back.**
> All-zero is right whenever the pattern already spells out its own shift
> alternation (DDNNOO, DuPont); round-robin is right whenever the pattern names
> one shift over and over and the crews have to be fanned out. Seeding only one
> leaves the climb stuck in the other's basin. Four tests pin this.

The hill climb (`localImprove`) has three move types, each earning its keep:
move a crew's day (explores rest staggers), move its shift step (explores which
shift it fills), swap two crews' whole placements (matters once crews differ in
size). Duplicate day offsets are **deliberately allowed** — two crews on the
same rhythm with different steps is the correct answer for an office 5-2 with a
morning and a night shift.

The result is **deterministic**: the same slots, crews and shift order always
produce the same placements, so re-running never shuffles a roster the user has
already looked at.

### Performance

Every journey the pattern admits (`cycleLength × shiftCount` of them) is
resolved once up front into a typed array: the shift index worked each day, how
many days that is, and how many quick turnarounds it contains. Turnarounds are a
*per-crew* property, so they never depend on who else is placed and never need
recomputing inside the loop. Scoring a candidate is then a walk over `crewCount`
rows of an `Int16Array` rather than rebuilding a matrix of `Map`s — the
search-heavy test suite runs about 12× faster as a result.

---

## 5. What is checked, and how loudly

An unstaffed shift is **a warning, never a validation error**. Whether a hole is
fixable depends on the crew count, not on the shape of the data, so `Next`
always advances and the coverage panel carries the whole message.

Severity is decided by **fixability**, not by how bad the outcome looks:

| Severity | Meaning |
| --- | --- |
| `error` | Nothing to work with — no pattern, or nobody on it. |
| `warning` | A different assignment would genuinely improve this. |
| `info` | A property of the pattern and crew count that **no assignment can change.** |

> **The trap worth remembering.** "Fewer crews than the grid needs" is *not* a
> bad assignment, and coding it that way flags a textbook-correct roster as
> broken — it tells someone who has just pressed *Suggest* to press it again.
> An office 5-2 has nobody in on Saturday **by design**.

### The warnings

| Code | Severity | What it catches |
| --- | --- | --- |
| `no-positions` | error | No pattern built yet. |
| `no-crews` | error | Nobody assigned. |
| `coverage-gap` | warning / info | A cycle day nobody at all works. |
| `uncovered-shift` | warning / info | A named shift with nobody on it, listing the days. |
| `uneven-coverage` | warning | Crews on duty swings by more than one across the cycle. |
| `crew-double-booked` | warning | One crew on two shifts the same day — reachable only by hand. |
| `long-work-run` | warning | More than 7 consecutive worked days, or a crew that never rests. |
| `quick-turnaround` | warning | Under 11 hours between clocking off and back on (EU Working Time Directive). |
| `weekend-imbalance` | warning | Weekend load differs by more than one day between crews. |
| `weekday-anchor` | info | A whole-week cycle not starting on a Monday. |
| `weekday-drift` | info | A cycle that is not a whole number of weeks, so weekdays walk. |

### Rest is measured in hours, not list positions

This distinction is the whole point of the check. Shifts are ordered by start
time, so **Night → Morning steps one place *forward* through the list** while
being the textbook quick turnaround — off at 06:00, back on at 06:00. A rule
written on list indices waves through the one transition it exists to catch.

An overnight shift's end is pushed past 1440 minutes, so
`1440 + nextStart − prevEnd` lands on zero rather than going negative. Shifts
with no enabled day are left out entirely rather than defaulted — inventing
hours for an unconfigured shift would invent a violation with them.

The check wraps the end of the cycle, because the cycle repeats: a rotation that
only breaks the rule across that seam breaks it every time it comes round.

---

## 6. Preset coverage

All seventeen presets, measured (`minShifts` shifts, `suggestedCrews` crews):

| Preset | Cycle | Shifts | Crews | Needed | Covers everything? |
| --- | --- | --- | --- | --- | --- |
| 5 on / 2 off | 7 | 1 | 1 | 2 | No — the weekend, by design |
| 4 on / 3 off | 7 | 1 | 1 | 2 | No — by design |
| 6 on / 2 off | 8 | 1 | 1 | 2 | No — by design |
| 4 on / 2 off | 6 | 1 | 3 | 2 | **Yes**, flat at 2 on duty |
| 3 on / 3 off | 6 | 1 | 2 | 2 | **Yes**, flat |
| 4 on / 4 off | 8 | 1 | 2 | 2 | **Yes**, flat |
| DDNNOO | 6 | 2 | 3 | 3 | **Yes** — an exact fit, nothing spare |
| Metropolitan (2-2-4) | 8 | 2 | 4 | 4 | **Yes**, flat |
| One card per shift + rest | 3 | 2 | 3 | 3 | **Yes**, flat |
| 2-2-3 Continental (Panama) | 14 | 1 | 4 | 2 | **Yes**, flat |
| Pitman (2-3-2) | 14 | 1 | 4 | 2 | **Yes**, flat |
| 2-2-3 with 28-day day/night flip | 28 | 2 | 4 | 4 | **Yes**, flat |
| DuPont | 28 | 2 | 4 | 4 | **Yes**, flat |
| Weekly forward rotation | 28 | 3 | 4 | 4 | **Yes**, flat at 3 on duty |
| Southern Swing | 28 | 3 | 4 | 4 | **Yes**, flat at 3 on duty |
| Seven-week master rotation | 49 | 3 | 7 | 6 | **Yes**, but on duty swings 3–5 |
| Healthcare 5/2 rotating | 28 | 3 | 4 | **7** | **No** — see below |

Two entries need explaining rather than fixing.

**`master_49` cannot be flat.** 7 crews × 30 working days = 210 crew-days over
49 days is a mean of 4.29 on duty, so a spread of ≤1 is arithmetically out of
reach. Recorded as a commented exception in the test rather than by loosening
the flatness rule for all seventeen presets.

**`healthcare_five_two` does not cover at its suggested crew count.** Each crew
works 19 of 28 days, so four crews bring 76 crew-days to 84 cells — 16 cells
stay open, and it takes 7 crews to fill them all. Four is the staffing the
real-world write-up specifies, so the preset keeps it and the coverage panel
names the open cells. *(The preset's description previously said "leaves nights
uncovered on one cycle day", which understated this considerably; corrected.)*

> **"Just alternate the shifts" is not a rule.** A sweep over cycle lengths 4–12
> across 2 and 3 shifts found **55 counterexamples**. Alternating rescues the
> 7-day 5-2 (4 crews → 3) and *ruins* the 6-day two-block roster (3 → 4). Two
> named tests pin both directions. It had been written into the UI copy as
> advice before anyone tested it.

---

## 7. Are all the general cases covered?

### Schedule kinds

| Kind | Status |
| --- | --- |
| `daily` → `weekly` (a named week of a month) | Supported |
| `daily` → `weekly_one` (recurring weekdays) | Supported |
| `daily` → `monthly` (named days of named months) | **Disabled in the UI.** The schema and rendering still work, so existing records load; only picking it anew is blocked. |
| `regular` → `fixed` | Supported |
| `regular` → `flexible` | Supported |
| `regular` → `rotate` | Supported — the subject of this document |

### Rotation cases the algorithm handles

- **Continuous 24/7 coverage** — any number of shifts, any crew count, flat by
  construction where the arithmetic allows.
- **Office weeks that are meant to have gaps** — reported as `info`, never as a
  mistake.
- **Patterns that name one shift throughout** — staffed across every selected
  shift via `shiftStep`.
- **Patterns that spell out their own alternation** (DDNNOO, DuPont) — the
  all-zero seed keeps them as written.
- **Block patterns** — repeated positions, so fewer crews than positions.
- **Whole-week block rotations** (the 0/7/14/21 stagger the real-world
  write-ups use) — this is literally the first search seed.
- **Cycles that are not whole weeks** — supported, with a `weekday-drift` note
  that the working weekdays walk on each repeat.
- **"Repeat indefinitely every 28 days"** — a 28-card pattern with
  `end_settings: never`.
- **Crew start days as a first-class, editable, persisted field** —
  "Team B starts on week 2", readable on the step, on the Summary, and on
  `/schedule-rotation`.
- **Free cell editing** — any single cell, without dragging a crew's journey
  along; the roster is graded honestly afterwards rather than re-derived from
  offsets that no longer describe it.
- **Deleted shifts and employees** — an unknown shift id passes through
  unrotated so it stays visibly wrong instead of silently becoming a different
  shift; a team or employee the stores no longer know about is dropped rather
  than reported as phantom coverage.
- **Overnight shifts** — handled in the rest arithmetic, and in
  `calculateHours`.

### What is *not* covered

These are deliberate boundaries, not oversights. Nothing in the code pretends
otherwise.

1. **Weekend equity is warned about, not optimised for.** `weekend-imbalance`
   fires, but no scoring term pushes toward even weekends. Deferred on purpose:
   stacking two new scoring terms at once makes a regression unattributable.
2. **Skill mix and per-role headcount are out of scope.** A crew is one
   indivisible unit; the algorithm never asks whether it contains the right
   people. That is a question about team *composition*.
3. **Individual availability, leave and absence do not exist.** There is no
   holiday, sick-leave or unavailability concept feeding the search.
4. **`monthly` shift-repeat rules are parity-only.** In `custom_shifts` mode a
   monthly card behaves exactly like a daily one — one day per card, no date
   filtering. The fields are validated but do not yet shape the calendar.
5. **Per-day headcount targets are not expressible.** You can say "Night must be
   covered"; you cannot say "Night needs three crews on Fridays".
6. **No cost, seniority, fairness-over-time or preference modelling.**
7. **Long cycles above the exhaustive budget fall back to seeded local search.**
   Still deterministic and still good, but no longer provably optimal over day
   offsets.
8. **There is no backend.** Everything persists to `localStorage` through
   `schedules-store.ts` and is re-validated against `scheduleSchema` on load.

---

## 8. If you change this code

- **Do not re-derive the "understaffed" rule from outcomes.** Severity comes
  from fixability. There is a regression test named for the trap.
- **Do not collapse the two shift-step seeds.** Four tests cover it.
- **Do not measure rest in list positions.** See §5.
- **Do not add a `stale` flag next to `crew_placements`.** See §1.
- **Do not re-display a warning without naming its shift.** The panel stopped
  being read once it emitted near-identical paragraphs; that is why the messages
  name the shift and why quick turnarounds are one line, not one per occurrence.
- **Any `FormField` whose `name` comes from state needs a `key`.** React Hook
  Form re-registers a controller under a changed `name` while it still holds the
  old value — which is how flipping Teams ⇄ Employees once copied employee ids
  into `team_ids`.
- **Add new worked examples to `doc-examples.test.ts`,** so this document keeps
  failing the build when it goes stale.
