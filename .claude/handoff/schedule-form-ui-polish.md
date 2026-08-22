# Handoff: schedule-form UI polish (rotate / summary / nav)

**SHIPPED 2026-08-22 in `d43c79d` (pushed to `main`).** Everything below
is done; this file is kept as the record of *why* it was built this way.
The work went in as part of one larger commit rather than the split
suggested at the bottom — it overlaps the shift-policies work in six files
(`pattern-builder`, `schedule-form`, `shift-picker-field`,
`recurrence-frequency-fields`, `sidebar-data`, `shifts/data/data.ts`), so
file-level splitting would have misattributed hunks and risked a
non-building intermediate commit. See `.claude/handoff/shift-policies.md`
for what landed alongside it.

## What this task was

A batch of UI requests against the `schedules` feature's multi-step
`ScheduleForm`, plus one sidebar rename. Five asks, all delivered:

1. Disable every case where **monthly** is offered as an option.
2. Tell the user drag-and-drop is available in the rotate pattern builder.
3. Rework the **Summary** step: merge basics + type into one block, render
   shifts the way step 2 does, show only the rotate *type*, compact overall.
4. Sidebar: rename Shifts → **Shift management** with 2 children.
5. (Follow-up) Default the custom-alternate **repeat frequency to Weekly**.

## The one real bug found (root-caused, not guessed)

Ask #5 looked like a no-op — `ShiftRepeats` in `pattern-builder.tsx` had
*already* been writing `frequency: 'weekly'` into every new `shift_repeat`
row since commit `151ba65`. It wasn't sticking.

Driving the real app with Playwright and instrumenting the effect showed
`replace()` writing `weekly` correctly, then the value coming back as `""`
~300ms later, leaving the dropdown on its placeholder with a visible
`Invalid option: expected one of "daily"|"weekly"|"monthly"` error.

**Cause:** Radix `Select` keeps a hidden native `<select>` for form
participation. When the value goes from `undefined` to a *programmatically*
set one, that hidden select has no matching `<option>` yet, so it bounces an
empty string back out through `onValueChange` and wipes the default.

**Fix** (`src/components/recurrence-frequency-fields.tsx`): ignore empty
values in `onValueChange`. A real user pick is never empty — Radix Select
has no clear affordance — so nothing legitimate is dropped. This also
protects the `shifts` feature's own Repeat tab, which shares the component.

Extracted to a global skill: **`radix-select-bubble-select-wipes-programmatic-value`**
(sibling of the existing `radix-radio-group-bubble-input-reopens-dialog` —
same Radix `BubbleInput` primitive, different component and symptom).

## Files touched

| File | What |
|---|---|
| `components/recurrence-frequency-fields.tsx` | **The bug fix** (empty-value guard) + per-option `disabled` on `RecurrenceOption` |
| `components/select-dropdown.tsx` | per-item `disabled` support |
| `components/layout/data/sidebar-data.ts` | Shifts → Shift management + 2 children |
| `schedules/data/data.ts` | `monthly` → `disabled: true` on cycle-length unit + shift-repeat frequency |
| `shifts/data/data.ts` | `monthly` → `disabled: true` on `REPEAT_FREQUENCY_OPTIONS` |
| `schedule-form/schedule-summary.tsx` | **full rewrite** — 5-6 cards down to 3 |
| `schedule-form/pattern-builder.tsx` | `PatternDragHint` component, rendered in both grid + per-month dialog |
| `schedule-form/shift-picker-field.tsx` | local `ShiftDaysTable` extracted out |
| `schedule-form/schedule-form.tsx` | legacy daily "Monthly" tab disabled |
| `shifts/components/shift-days-table.tsx` | **NEW** — shared collapsed "Day \| Times" table |

### Decisions worth not re-litigating

- **"Disable" was read as grey-out, not remove.** Monthly options stay
  visible but unselectable, so pre-existing monthly data still renders.
  The `isMonthly` month-box branch in `PatternDayGrid` is now effectively
  dead for new schedules — deliberately left in place for legacy data.
- **Rotate config card deleted entirely** from the Summary. Cycle length,
  per-shift repeat rows and total pattern length are gone; only "Rotate
  type" survives, as a row in Basics. That was the explicit ask.
- **`ShiftDaysTable` was moved to `features/shifts/components/`** (not a
  generic `components/`) since it's shift-domain UI and depends on shifts'
  own `DAY_LABELS`/`DayTimeEntry`.
- ~~**"Shift policies" nav item points at `'#'`.**~~ **Superseded
  2026-08-22:** it now points at a real `/shift-policies` screen — Kanj
  asked for one. See `.claude/handoff/shift-policies.md`.

## Verification state

- `tsc -b` clean, `vite build` clean.
- Verified **end-to-end in a real browser** (Playwright against the dev
  server), not just by reading code: both frequency dropdowns show Weekly
  with Monday pre-checked and no validation error; `Monthly` carries
  `data-disabled` while Days/Weekly don't; the drag hint renders; the
  sidebar expands to `Time Track → Shift management → Shifts / Shift
  policies`.
- Tests: **152 passed, 3 failed**. The 3 failures are in
  `src/context/search-provider.test.tsx` and are **pre-existing** —
  confirmed by re-running with the sidebar change stashed, they fail
  identically. Not caused by this work.
- Lint: 0 errors in touched files. `src/components/multi-select/index.tsx`
  has 9 pre-existing errors (`no-explicit-any`, `consistent-type-imports`) —
  untouched, unrelated.

## Gotcha for whoever commits this

**The repo has repo-wide Prettier drift** (~67 files fail
`prettier --check` at HEAD — looks like a plugin/version change in
`prettier-plugin-tailwindcss` / import sorting). I formatted **only the
files I edited**, deliberately not the other ~58, to avoid a huge unrelated
diff. Consequence: several touched files carry formatting churn mixed in
with real changes. `git diff -w` separates them — e.g.
`shifts/data/data.ts` is 144 lines with whitespace but only **22** without.
Review with `-w`. Note `pattern-builder.tsx` / `schedule-form.tsx` /
`schedules/data/data.ts` already had uncommitted prettier churn *before*
this session started.

Deciding whether to normalize the whole repo's formatting in one separate
commit is still open, and is Kanj's call.

## Outcome

1. ~~Commit the working tree~~ — **done**, `d43c79d`, pushed to `main`.
2. Repo-wide Prettier normalization: **still open.** Nothing was
   normalized wholesale; only touched files were formatted, and only
   where doing so didn't churn unrelated lines (see the gotcha above).
3. ~~Decide whether "Shift policies" gets a real page~~ — **it did.**
4. The 3 pre-existing `search-provider.test.tsx` failures are **still
   unowned** and still failing. Unrelated to this task.
