# Schedule wizard — Assign to / Work steps (rotate + fixed)

Crew assignment is back **inside the schedule creation wizard**, for **both
rotate and fixed**, split into a crew-pick step and an assignment step. The
"Assign crews" dialog on `/schedule-rotation` still exists for editing a saved
roster.

**State: committed and pushed to `main` 2026-09-15.** **Not
browser-verified.**

## Current step lists (`schedule-form.tsx#getSteps`)

- **Rotate:** Basics → Shifts → Pattern → **Assign to** → **Work rotation** →
  Start & End → Summary
- **Fixed:** Basics → Shifts → **Occurrence** → **Assign to** → **Work fixed** →
  Start & End → Summary
- **Flexible:** unchanged — Basics → Shifts → Start & End → Summary

Step ids: `assign-to` (crew pick), `work` (assignment; label depends on type),
`occurrence` (fixed only).

## Decisions locked (user's calls, 2026-09-13)

- **Start & End is the last step before Summary for both types.**
- **"Assign to"** = Teams/Employees toggle + that kind's dropdown only. The
  step after it is named **"Work rotation"** (rotate) / **"Work fixed"** (fixed).
- **Work fixed is manual-only** — no Suggest, no Suggest/Manual toggle.
  Work rotation keeps both.
- **Monthly is selectable in the Occurrence frequency dropdown** (still greyed
  in rotate's Custom-alternate repeat rows and the cycle-length picker).

## How it's built

- **`assign-to-crew-fields.tsx`** (new) — writes form fields `crew_kind`
  (`'team' | 'employee'`) and `crew_ids`. Switching kind clears `crew_ids`.
  The `FormField` is keyed on the kind (same remount rule as the 09-03 fix).
- **At least one crew is required**, enforced in `handleNext`
  (`setError('crew_ids')`), **not in the schema** — schema-level `min(1)` would
  make every seed and saved schedule fail `seed-store`'s `safeParse` and reseed.
- **Leaving Assign to prunes the roster** (`pruneRosterToCrews` in
  `rotation-crews.ts`): drops the other kind and unpicked crews from
  `day_coverage` and `crew_placements`, on both Next and tab-jump.
- **Work step** = the unchanged `ScheduleAssignToFields` with new opt-in props:
  `poolFromForm` (read `crew_kind`/`crew_ids`, hide its own toggle + pool
  picker, day-card options limited to the pick), `manualOnly` (fixed),
  `pattern` (fixed passes `occurrencePattern(...)`). `commitRef` now fires when
  leaving the `work` step (Next or tab jump).
- **Schema:** `crew_kind`/`crew_ids` are **optional** on rotate and fixed.
  Fixed additionally gained `occurrence` (defaulted to `DEFAULT_OCCURRENCE`,
  weekly Mon–Fri), `day_coverage` and `crew_placements` (default `[]`).
  Optional/defaulted so seeds and localStorage still parse; the Head Office
  fixed seed was given explicit values only because `schedules.ts` is typed
  as the *output* type. `SEED_VERSION` not bumped.
- **Old rosters:** `withCrewSelection` in `schedule-form.tsx` derives the pick
  from `day_coverage` (`crewSelectionFromDayCoverage`; teams win) when
  `crew_ids` is empty. The dialog's Save writes the derived pick too.
- **Occurrence step** (`occurrence-fields.tsx`): shared
  `RecurrenceFrequencyFields` + `RepeatMonthlyFields` under `occurrence.*`, plus
  Public holiday / Sick leave switches. **No End card** — Start & End owns it.
- **`occurrence-pattern.ts`** reads the rule as a rotate-style pattern, card 0 =
  `start_date`, every working card = `shift_ids[0]` (the search transposes each
  crew onto one shift, which is what makes it "fixed"):
  daily/N → N cards working the first; weekly/N → 7N cards, chosen weekdays of
  the first week; monthly/N → 30N cards (flat 30-day month, repo convention),
  matching days of the first 30.
- **Summary:** Occurrence line (fixed), Assign-to card listing picked crews +
  "Not yet assigned." / "N crews assigned." (`assign-to-status-note.tsx`, no
  longer points at Schedule Rotation). **View page** renders Occurrence, Assign
  to and Work steps read-only.

## Verification (2026-09-13)

- `npm run build` clean. **Full suite 366 passed / 0 failed** (2026-09-15),
  run through a temporary port-override config because `npm run test` hit
  `EACCES ::1:63315` — see CLAUDE.md's 2026-09-13 session state.
- eslint clean on touched files except the existing `form.watch`
  `react-hooks/incompatible-library` warning in `schedule-form.tsx`.
- `occurrence-pattern.test.ts` (7 tests) covers weekly anchoring, mid-week
  start, every-N-weeks/days, monthly date-specific and day-position.
- **Not verified:** nothing in the wizard was opened in a browser. **No test
  mounts the wizard** (`schedule-form.test.tsx` was deleted 09-11), so the new
  steps, the required-crew check, pruning, `withCrewSelection` and the View
  page are covered by typecheck only.

## Open questions — ask before building more

1. **Should the Occurrence step exist at all?** The user said "not the
   occurrence step in fixed type, its wrong", asked for a history of fixed
   steps (answered: Policy → Shift definition/Recurrence → Occurrence →
   Shifts/Start & End since 08-16; never a Pattern-like step), then asked to
   enable Monthly in it — but never confirmed keeping or removing it. It is
   still in the fixed flow.
2. **Start-date anchoring bug (offered, not answered).** The fixed pattern's
   day indices are anchored on `start_date`, and Start & End now comes *after*
   Work fixed. Assign Mon–Fri, then pick a Thursday start → the stored cells
   land on different weekdays. Proposed fix: store the fixed roster by weekday
   rather than by day index.
3. The manual grid for fixed renders **one card per cycle day**, including off
   days — 30/60 cards for monthly. Offered to hide off-day cards; not answered.

## What's left, in order

1. Resolve open questions 1–2 with the user.
2. Browser-walk both wizards: rotate (Assign to → Work rotation → Suggest →
   Start & End → Summary → save → edit reopens on the same crews) and fixed
   (Occurrence weekly + monthly → Assign to → Work fixed manual grid → Summary).
   Check the "Select at least one team or employee" block and that unpicking a
   crew removes it from the Work grid.
3. Add a wizard-level test (none exists) for the required crew pick and
   pruning.
4. ~~Commit and push.~~ **Done 2026-09-15.**
