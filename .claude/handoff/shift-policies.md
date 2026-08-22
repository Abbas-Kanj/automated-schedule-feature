# Handoff: shift policies as records (+ day durations, shadcn pass)

**SHIPPED 2026-08-22 in `d43c79d` (pushed to `main`).** 60 files,
+2280/−1033. Includes the previously uncommitted schedule-form UI polish —
see `.claude/handoff/schedule-form-ui-polish.md`.

## What was asked, in order

1. Shift form → Shift times tab: **Full Day / Half Day** duration inputs.
2. Shift form → Shift policy tab: drop the old content, add a **search** +
   **Add new policy** button opening a dialog (name, description, policy
   type, and for most types a collapsed set of rules); then **a policies
   screen with a table**.
3. Repoint the shifts table column and the row-menu drawer at the new
   policies.
4. A shadcn-components pass (use `Button`, not `<button>`), then a
   senior-level pass on structure and optimizations.

## The model that landed

A **shift policy is now a record**, not one of three hardcoded presets:

```
ShiftPolicy = { id, name, description?, policy_type, rules[] }
PolicyRule  = { id, name, from_time, to_time, factor, attendance_type }
```

- `policy_type`: Tardy | Departure | Missed Punch Error | Working on Day
  Off | Working on Public Holiday | Overtime.
- **Every type except Missed Punch Error carries rules** — that's what
  `policyTypeHasRules()` encodes, and it's the single switch the dialog,
  the schema's `superRefine` and the type-change handler all read.
- `factor` is `>= 1` in **half-steps** (`multipleOf(0.5)`), matching the
  input's `step={0.5}`. The read-only **Result** beside it is
  `(to − from) × factor`, derived, never stored.
- A shift attaches policies by id: **`policy_ids: string[]`** on
  `shiftFieldsSchema`. The old `policy_type` enum, `SHIFT_POLICY_DETAILS`,
  `policy-select-field.tsx` and `policy-pill-field.tsx` are **deleted**.

Feature lives at `src/features/shift-policies/`, mirroring `shifts/`
(`components/ data/ stores/ utils.ts index.tsx`). Store persists to
`localStorage` under **`"shift-policies"`**, re-validating with
`shiftPolicySchema` on load, same as `shifts`.

## Decisions worth not re-litigating

- **The picker is multi-attach.** A shift takes any number of policies —
  Tardy *and* Overtime *and* Missed Punch is the realistic case. One
  `PolicyPicker` serves both the form tab (writes to react-hook-form) and
  the table's "Modify policies" drawer (writes straight to the store).
- **Rules are a repeatable list, not one fixed block.** The ask read
  "Add policy name / Add from time to time / …", which is ambiguous; a
  list with an **Add rule** button covers the single-rule reading too.
  Picking a rule-bearing type seeds exactly one blank rule.
- **Rules are cleared on the type change itself**, not at submit.
  `policyRuleSchema` validates *every* array element regardless of type,
  so a half-filled rule left over after switching to Missed Punch Error
  would have blocked submit with an error on a field nobody can see.
- **`emptyShiftPolicyFormValues` is typed `DefaultValues<…>`**, which is
  how the form legitimately starts with no `policy_type` — no cast.
- **Nested-form hazard, handled:** `PolicyFormDialog` can open from inside
  the shift form. Radix portals the DOM out, but React still bubbles the
  inner `submit` through the *React* tree, so its `onSubmit` calls
  `event.stopPropagation()`. Removing that line silently makes saving a
  policy also submit the shift.
- **Two `Select`s carry the empty-value guard** (`if (!value) return`) —
  policy type and attendance type. The latter is written programmatically
  by `buildDefaultRule`, which is exactly the case the
  `radix-select-bubble-select-wipes-programmatic-value` skill describes.

## Shared extractions (the senior pass)

| New | Replaces |
|---|---|
| `components/data-table/data-table.tsx` | schedules / shifts / policies tables, which were identical apart from columns + filter (3 × ~120 lines → 3 × ~10) |
| `components/toggle-button.tsx` | the hand-rolled `checked ? 'bg-primary …' : 'hover:bg-accent'` toggle duplicated in **4** grids; now `Button` variants, so the grids finally get focus-visible rings |
| `lib/id.ts` (`generateId`) | three identical copies |
| `lib/time.ts` (`toMinutes`) | two identical copies |
| `shift-policies/components/policy-rules-field.tsx` | the rules half of a 460-line dialog; each row `useWatch`es only its own slice instead of re-rendering every row per keystroke |

Also converted raw `<input>`/`<button>`/`<label>` that carried **stale
copies of the shadcn class strings** (`pattern-builder.tsx` ×2,
`password-input.tsx`), and swapped three manual `fieldState.error`
paragraphs for `FormMessage`. Dropped the per-render
`shiftSchema.parse(row.original)` in the shifts row actions — the store
already validates on load.

## Verification state

- `tsc -b` + `vite build` clean. **Note:** `tsc --noEmit -p tsconfig.json`
  is *not* enough on this repo — it missed a genuine missing-import error
  that `npm run build` (`tsc -b`, project references) caught. Use the
  build.
- Tests **161 passed, 3 failed** — the 3 are the pre-existing, unowned
  `search-provider.test.tsx` failures. 9 new tests in
  `shift-policies/data/schema.test.ts` cover the factor half-step rule,
  window validation and the result math.
- Lint clean except the 9 pre-existing errors in the vendored
  `components/multi-select/index.tsx`.
- **NOT verified in a real browser.** No browser tooling in that session.
  The `ToggleButton` conversions touch schedule-form screens that *were*
  hand-verified the session before, so those are the ones to click through.

## Pick up here

1. **Click through the schedule form** (weekday grids, month-day grid,
   cycle-length picker, calendar day picker) — the `ToggleButton` swap is
   the only visually risky part of the commit. Any miss is a one-line
   `className` fix.
2. **Existing `shifts` in `localStorage` show no policies** until
   re-attached: zod strips the dead `policy_type`, `policy_ids` defaults
   to `[]`. Clearing the `shifts` key restores the seeded examples (which
   do reference the seeded policies).
3. `knip` still reports, all **pre-existing**: two dead files
   (`schedules/schedule-form/badge-color-field.tsx`,
   `icon-picker-field.tsx`) and two unused deps
   (`@radix-ui/react-accordion`, `@radix-ui/react-collapsible` — the ui
   primitives import the unified `radix-ui` package instead).
4. Repo-wide Prettier normalization is **still an open call.** Running
   `prettier --write` on an untouched HEAD file reorders unrelated
   Tailwind classes, so it must be its own commit if it happens.
