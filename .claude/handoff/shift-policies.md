# Handoff: shift policies

Current state of the `shift-policies` feature and the shift-form surfaces
that consume it.

## Where things stand

- **Shipped `d704677` + `c98ac3a`, pushed to `main`** (2026-08-22). The
  feat commit moved the policy type onto individual rules and added the
  missed-punch rule shape; the chore commit is regenerated
  `routeTree.gen.ts` only.
- **The follow-up UI batch shipped `efb71a0`, pushed to `main`**
  (2026-08-22, 8 files, +388/−187): `schedule-summary.tsx`,
  `policy-picker.tsx`, `policy-rules-field.tsx`, `shift-policies/utils.ts`,
  `shift-times-tab.tsx`, `shifts/data/schema.ts`, `shifts/data/defaults.ts`,
  and new `time-24-input.tsx`. Typechecking and green on tests, still not
  browser-verified.
- The earlier "shift policies as records" work (`d43c79d`) and the
  schedule-form polish that rode with it are **done** — see
  `.claude/handoff/schedule-form-ui-polish.md` for the latter.

## The model (current)

A policy is a **named bag of typed rules**. The policy itself has no type:

```
ShiftPolicy      = { id, name, description?, rules[] }
PolicyRule       = WindowRule | MissedPunchRule   // discriminated on policy_type
WindowRule       = { id, policy_type, name, from_time, to_time, factor, attendance_type }
MissedPunchRule  = { id, policy_type: 'missed_punch_error', name,
                     operator, occurrences, period_unit, from_period, to_period,
                     attendance_type: 'deduction', deduction_unit, deduction_hours? }
```

- `policy_type` on a rule: Tardy | Departure | Missed Punch Error | Working
  on Day Off | Working on Public Holiday | Overtime. One policy can mix
  them — the seeded "Attendance" policy deliberately does.
- `WINDOW_POLICY_TYPES` is a **hand-written tuple** separate from
  `POLICY_TYPES` (not filtered from it) so `z.enum` gets literal types.
  Adding a type means touching both.
- `factor` is `>= 1` in half-steps; the read-only **Result** beside it is
  `(to − from) × factor`, derived, never stored.
- A missed-punch rule is always booked as a deduction —
  `z.literal('deduction')`, shown as a disabled select. Only the "Hours"
  deduction unit carries a number; half/full day resolve against the
  shift's own day-duration fields.
- A shift attaches policies by id: **`policy_ids: string[]`**.

## Decisions worth not re-litigating

- **Cross-field checks live in the policy-level `superRefine`**, keyed off
  each rule's own type — `z.discriminatedUnion` needs its members to be
  plain `ZodObject`s, so they can't carry their own refinements.
- **Retyping a rule goes through `useFieldArray.update` + `retypeRule`**,
  not per-field `setValue`: the registered fields change with the shape.
  `retypeRule` keeps the id and name and defaults the rest; a
  window→window move keeps everything.
- **`Time24Input` replaces `<input type="time">` in the rule editor.**
  The native control takes its 12/24-hour format from the *browser's*
  locale, which the page cannot override — `lang="en-GB"` on the input is
  widely-repeated advice that does **not** work in Chrome (tried it, Kanj
  came back with the same complaint). The masked text field is the only way
  to guarantee no AM/PM. Cost: those two fields lose the native picker.
  Everywhere else (`shift-times-tab`, schedule form) still uses
  `type="time"` on purpose — nobody has complained about those.
- **The eye on an attached policy expands it in place**, one row per id, so
  several can be open at once. An earlier `PolicyDetailsDialog` was built
  and then deleted when Kanj said modal was wrong — don't reintroduce it.
- **The picker's catalogue is a dropdown**, not an inline list: focusing
  the search box opens it, and it offers only *unattached* policies.
  Closing is on a document `pointerdown`/Escape listener scoped to a
  wrapper ref — a plain `blur` fires before the click on a result lands and
  eats the first selection.
- **Nested-form hazard, still live:** `PolicyFormDialog` can open from
  inside the shift form. Radix portals the DOM out, but React still bubbles
  the inner `submit` through the React tree, so its `onSubmit` calls
  `event.stopPropagation()`. Removing that makes saving a policy also
  submit the shift.
- **Every `Select` written programmatically carries the `if (!value) return`
  guard** — rule type, attendance type, missed-punch operator. See the
  `radix-select-bubble-select-wipes-programmatic-value` skill.
- **The stored schema is not lenient any more.** An earlier pass kept
  `shiftPolicySchema` permissive so legacy records survived; the rule-type
  move made that pointless, so there's no migration. Existing
  `localStorage` policies fail to parse and the store falls back to the
  seeds — it self-heals on the next save. Knock-on: a shift whose
  `policy_ids` pointed at a hand-made policy loses that link.

## That batch, in detail

1. **Shift times tab**: new optional `start_date` on `shiftFieldsSchema`
   (a `yyyy-MM-dd` string, nothing validates against it yet), rendered with
   the existing `DateField` **above** the Break time block. Day-duration
   inputs stack as `label · input · hours` and got their placeholders back
   ("Full day work duration" / "Half day work duration").
2. **Policy picker**: search dropdown of available policies; attached rows
   show eye (expand in place) · pencil · ✕.
3. **Rule editor**: `describeRule` extracted to `utils.ts` so the collapsed
   rule row and the expanded picker row share one description string.
4. **Schedule summary → Basics**: values sit next to their labels via a new
   `inline` variant on `SummaryRow`. Other summary cards keep the
   label-left/value-right layout.

## Verification state

- `tsc -b` + `vite build` clean; `shift-policies` + `shifts` + `schedules`
  tests **34 passed**. `schema.test.ts` covers the discriminated union,
  mixed-type policies, both cross-field checks and `getPolicyRuleTypes`.
- **Typecheck with `npm run build`, not `tsc --noEmit -p tsconfig.json`** —
  the latter misses errors on this repo (project references).
- **Nothing in this feature has been verified in a real browser.** The
  riskiest unchecked pieces, in order: the search dropdown's click-away
  behaviour, `Time24Input`'s masking on real keystrokes, and the rule-type
  switch re-rendering the row's inputs.

## Pick up here

1. **Click through the policy dialog and the shift policy tab** — see the
   unverified list above.
2. Decide whether the collapsed rule summary should also force 24-hour. It
   currently honours Settings → Display, so it reads "9:00 am" on a 12h
   preference while the inputs right above it are always 24h. Flagged to
   Kanj, no answer yet.
3. Repo-wide Prettier normalization is **still an open call**: running
   `prettier --write` on an untouched HEAD file reorders unrelated Tailwind
   classes, so it must be its own commit if it happens.
4. `knip` still reports, all pre-existing: two dead files in
   `schedules/schedule-form/` (`badge-color-field.tsx`,
   `icon-picker-field.tsx`) and two unused deps
   (`@radix-ui/react-accordion`, `@radix-ui/react-collapsible`).
5. `search-provider.test.tsx` has 3 pre-existing, unowned failures —
   unrelated to this feature.
