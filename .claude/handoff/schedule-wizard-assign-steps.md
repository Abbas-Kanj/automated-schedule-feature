# Schedule wizard — assignment steps (rotate + fixed) and the Assign crews dialog

Where crew assignment lives, per schedule type, and how the wizard moves
between steps.

**State (2026-09-16): UNCOMMITTED.** Working tree holds the whole rework
below (31 files, incl. 5 new, 1 deleted). Last commit on `main` is `52271e2`.
Browser-verified this session (see Verification).

## Current step lists (`schedule-form.tsx#getSteps`)

- **Rotate:** Basics → Shifts → Pattern → **Assign to** → Start & End → Summary
- **Fixed:** Basics → Shifts → **Occurrence** → **Start & End** → **Assign to** → Summary
- **Flexible:** unchanged — Basics → Shifts → Start & End → Summary

The `work` step ("Work rotation" / "Work fixed") **no longer exists** (removed
2026-09-16).

## Decisions locked (user's calls)

- **Fixed occurrence is always per shift** — one frequency block per selected
  shift, like rotate's "Custom alternate". Not a toggle; the single rule is gone.
  Exceptions (public holiday / sick leave) stay schedule-wide. (2026-09-16)
- **Fixed crews are assigned per shift on "Assign to"**; Teams vs Employees is
  chosen **once for the schedule**. The same crew **may** be on several shifts —
  warned (amber count + per-card note), never blocked. Next blocks only when
  nobody is assigned at all. (2026-09-16)
- **Rotate placement happens only in the "Assign crews" dialog** on the
  rotating Work schedule screen; the wizard's Assign to picks the pool only.
- **Going back clears every later step — create mode only.** Editing keeps
  saved data. (2026-09-16)
- **Dialog requires Start & End before Suggest/manual/tables**, and its tables
  read in **real dates**. Crew start days editor and per-crew table **removed**;
  the rotating screen's Employees table replaces the crew table. (2026-09-16)
- **Summary calendar shows crews per shift.** (2026-09-16)
- Monthly stays selectable in Occurrence (2026-09-15).

## How it's built

**Fixed schema** (`data/schema.ts`, fixed arm):
- `shift_occurrences: {shift_id, frequency, interval, weekdays?, monthly_mode?, …}[]`
  — superRefine requires **exactly one row per `shift_ids` entry**.
- `occurrence_exceptions`, `crew_kind`, `shift_assignments: {shift_id, employee_ids, team_ids}[]`
  (assignment shift must be a selected shift).
- **Removed from fixed:** `occurrence`, `day_coverage`, `crew_placements`, `crew_ids`.
- Weekly/monthly rule checks deduplicated into `refineRecurrenceRule(rule, ctx, path)`,
  used by both `shift_occurrences` rows and rotate's `shift_repeat` rows.
- **Migration:** `fixed-schedule.ts#migrateLegacyFixedSchedule` runs as a
  `z.preprocess` in `schedules-store.ts` — old `occurrence` → one row per shift,
  slot-keyed `day_coverage` → grouped by shift into `shift_assignments`.
  `SEED_VERSION` not bumped (no schedule seeds ship).
- `fixed-schedule.ts` also holds `shiftCrewIds`, `withShiftCrewIds` (drops
  empty rows), `crewsOnMultipleShifts`, `assignedCrewIds`.

**`occurrence-pattern.ts`** is now just `occurrenceLabels(rule)` ("Mon", "Day 15",
"2nd Mon") and `occursOn(rule, start, date): boolean`. **The 2026-09-15
slot-key storage scheme (1000/2000/3000 keys, `occurrenceSlots`) is deleted** —
per-shift assignment made it unnecessary.

**Wizard components:**
- `per-shift-recurrence-fields.tsx` — extracted from pattern-builder's
  `ShiftRepeats`; used by rotate (`shift_repeat`) and fixed (`shift_occurrences`).
  **Rows are rendered from `useFieldArray`'s `fields`, not `shiftIds`** — see bug below.
- `fixed-assign-to-fields.tsx` — per-shift `FilterableMultiSelect`s + warning.
- `assign-to-crew-fields.tsx` — rotate only (pool pick, `crew_ids` required in `handleNext`).
- `schedule-form.tsx` — `resetLaterStepsOnBack` prop (only
  `pages/create/schedule-create-page.tsx` passes it). `resetStepsAfter(index)`
  resets every later step's `getStepFields` + `STEP_DEPENDENT_FIELDS`
  (`pattern`/`assign-to` → `day_coverage`, `crew_placements`) to
  `getRegularTypeDefaults`, never `type`/`parent_type`, then `setMaxStep(index)`.
  Back button goes through `goToStep` too.

**Dialog** (`schedule-rotation/components/assign-crews-dialog.tsx` →
`schedule-form/schedule-assign-to-fields.tsx`, now dialog-only):
- Props: `schedule` (stored record; live form values laid over it),
  `commitRef`, `startEnd` slot. Removed props: `manualOnly`, `poolFromForm`,
  `slotKeys`, `dayLabels`, `pattern`.
- Order: Teams/Employees + pool → Start & End → Suggest/Assign manually → tables.
- Gate: `dateStringSchema` + `endSettingsSchema` safeParse; `commitPendingSuggestion`
  no-ops until ready.
- Pool seeds from placed coverage, else from the wizard's `crew_kind`/`crew_ids`.
- Dates: `schedule-rotation/utils.ts#cycleDayDates(schedule, periodType)` walks
  `getPeriodIndex` for the first date of each cycle day; headers `EEE d MMM`.
- `rotation-coverage-panel.tsx` lost its crew table and `crews` prop; takes
  `children` (the `ScheduleRotationTable`) between the grid and the warnings.
- `RotationRow.startDate` (from `cycleDayDates`) → "starts Wed, Sep 16" on the
  dialog *and* the rotating screen.
- `rotation-crew-starts.tsx` **deleted** (`CrewStartEditor`/`CrewStartSummary`).
  `crew_placements` is still written by Suggest and still drives `startDay`.

**Summary / calendar:** `getScheduleCalendarCycle` entries carry `teamIds`/`employeeIds`.
Fixed: shifts whose rule `occursOn` the date, crews from `shift_assignments`.
Rotate: once `day_coverage` exists, every shift covered on that date's card
with its crews; before that, the old one-journey template + a note.
Double-booked crew line is amber. Flexible unchanged.

**Fixed Work schedule** (`fixed-work-schedule/utils.ts`): `makeWorkingShiftsOn`
replaces `makeWorkingKeyOn`; `after_occurrences` counts days any shift works.
Timeline/roster reuse the rotation helpers by feeding `shift_assignments` as
cells keyed by clock-order shift index.

## Bugs found and fixed (2026-09-16)

- **Frequency select showed "Select a frequency" although the value was
  weekly** (fixed Occurrence; same component for rotate's repeat rows). Root
  cause: rows mapped over `shiftIds` mounted *before* the sync effect's
  `replace()` wrote the rule, so the Radix `Select` got `value={undefined}` and
  kept the placeholder once the real value arrived. Fix: render from the field
  array. **Invisible to build and all tests** — found only in the browser.
- **Wizard pool didn't reach the dialog** — a rotate schedule saved from the
  wizard opened "Assign crews" with an empty pool (pool only derived from
  `day_coverage`). Fixed + tested. Also found only in the browser.

## Verification (2026-09-16)

- `npm run build` clean. `npm run test` **435 passed / 0 failed**, 36 files
  (plain `npm run test` worked — no port workaround needed today).
- eslint: 0 errors on touched files; 3 warnings, all pre-existing in kind
  (`exhaustive-deps` in pattern-builder and the moved per-shift effect,
  `incompatible-library` on `form.watch`).
- New tests: `schedule-form.test.tsx` (fixed step order, create-mode reset +
  relock, edit-mode keep, multi-shift warning), `fixed-schedule.test.ts`,
  `cycleDayDates`, fixed schema rules, dialog date gating / date labels /
  employees table / pool seeding; `fixed-work-schedule/utils.test.ts` and
  `occurrence-pattern.test.ts` rewritten.
- `vite.config.ts` `optimizeDeps.include` += `@radix-ui/react-checkbox`,
  `@radix-ui/react-tabs`, `radix-ui` (mid-run reload the first time a test
  mounted the whole wizard).
- **Browser-walked** (Playwright against `vite --port 5391`, fresh
  localStorage): fixed create → per-shift Occurrence → Start & End → Assign to
  with Team A on both shifts (warning shown) → Summary calendar with crews →
  jump back to Occurrence (later steps locked, Assign to emptied) → save →
  `/work-schedule/fixed`. Rotate create (5-step list, 5-2 preset, pool pick) →
  save → `/work-schedule/rotating` → Assign crews (pool prefilled, date headers,
  Employees table) → Suggest → Save → screen shows "starts <date>".
- **Not verified in a browser:** monthly per-shift occurrence, the dialog's
  date gate with an invalid end setting (unit-tested only), manual grid in the
  dialog, edit-mode "keeps data" (unit-tested only), the View page, a legacy
  fixed record actually loading from localStorage (migration unit-tested only).

## What's left, in order

1. **Commit** — the whole batch is uncommitted. Prettier normalized touched
   files, so review with `git diff -w`.
2. Warning messages under the dialog's coverage table still name cycle days by
   number ("(3, 4)") while the table headers show dates — reword if the user
   wants dates everywhere. Not asked for.
3. Browser-check the unverified items above, especially a monthly per-shift
   rule and the View page for a fixed schedule.
4. ~~Browser-walk both wizards~~ — done 2026-09-16 (see Verification).
5. ~~Add a wizard-level test~~ — done 2026-09-16 (`schedule-form.test.tsx`).
