# automated-schedule-feature

## What this is

Three real feature modules — **`schedules`** (shift/day-based scheduling,
heavy cross-field validation), **`shifts`** (reusable shift definitions),
and **`shift-policies`** (attendance rules attached to shifts) — built on
top of the [shadcn-admin](https://github.com/satnaing/shadcn-admin) admin
dashboard template, plus `schedule-rotation`, `schedule-templates`,
`employees`, `employees-list`, `teams` and `public-holidays`.
**The template's demo modules were deleted on 2026-09-11** (users, tasks,
chats, apps, dashboard, and the whole Clerk route tree) — `settings`,
`auth` and `errors` are the only template features left. GitHub Pages
deploy configured via `.github/workflows/deploy-pages.yml`.

**`docs/ARCHITECTURE.md` and `docs/FEATURE_MAPPING.md` no longer exist** —
they were removed in commit `de7eaa0`, so every reference to them below
(and to `docs/TARGET_ARCHITECTURE.md`) is dangling. The one live document
is **`docs/ROTATION_ALGORITHM.md`**, which is the current-state map for the
rotate model and is kept honest by `schedules/doc-examples.test.ts`.

Repo: https://github.com/Abbas-Kanj/automated-schedule-feature

**This file and `.claude/handoff/*.md` are checked in** (since 2026-08-22)
— they're shared project context, not machine state. The rest of
`.claude/` (local settings, permissions, lock files) stays gitignored via
`.claude/*` + `!.claude/handoff/`; note the ignore has to target the
directory's *contents*, since git can't re-include a path under an ignored
directory.

## Stack decisions (and why)

- **Vite 8 + React 19 + TypeScript**, TanStack Router (file-based routing,
  `src/routeTree.gen.ts` is generated — never hand-edit).
- **ShadcnUI/Radix + Tailwind v4**, with RTL support via `DirectionProvider`.
  Some `src/components/ui/*` primitives are hand-modified for RTL — check the
  README's "Customized Components" list before re-running the Shadcn CLI
  against those files.
- **react-hook-form + zod**: `scheduleSchema` (`src/features/schedules/data/schema.ts`)
  is the source of truth for validation — a discriminated union on
  `parent_type` (`daily` → weekly/weekly_one/monthly; `regular` → shift-based
  with `superRefine` cross-field rules). Read it before touching form
  validation or the multi-step `ScheduleForm` stepper.
- **Zustand for client state**; `schedules-store.ts` persists to
  `localStorage` (key `"schedules"`), re-validates against `scheduleSchema`
  on load. **No backend today** — TanStack Query is wired (401/500 handling)
  but not actually driving `schedules` yet.
- **One auth flow**: mock (`auth-store.ts`, used under `_authenticated/**`).
  The partial Clerk flow under `routes/clerk/**` and the `@clerk/react`
  dependency were **deleted on 2026-09-11** — it was never wired into the main
  app shell, and its only authenticated page was the `users` demo.
- **Vitest in real Chromium** via `@vitest/browser-playwright`, tests
  colocated as `*.test.ts(x)`.

## Known environment gotchas

- **The `D:\skills` backup drive can remount under a different letter —
  seen as `E:\skills` on 2026-08-16.** Same content (check
  `E:\skills\LAST-SYNC.txt` / `.sync-log.jsonl` for provenance — it's a
  cross-machine backup, previously pushed to by `Kanj@DESKTOP-4B7D3GL`, also
  pushed to by `abbas@KENJI-LAPTOP` (this machine) on 2026-08-16). Don't
  assume the letter is stable across boots; check both if a path off it
  404s. Diffed local `~/.claude/skills` vs. this drive by content hash on
  2026-08-16: identical for all 29 shared skills except
  `opencode-agents-bridge/assets/bridge-template/scripts/Watch-Agent.ps1`
  (local was newer, 08-14 vs. the drive's 08-12) and one local-only skill,
  `winget-machine-scope-uac-hang-noninteractive`. Nothing needed pulling
  from the drive; both of those were pushed to `E:\skills` this session, so
  local and the drive are now fully in sync (31 folders each).
- **`docs/TARGET_ARCHITECTURE.md` is referenced** (by `ARCHITECTURE.md` and
  `FEATURE_MAPPING.md`) **but doesn't exist in this checkout.** Either it
  never got committed or was lost between machines — don't assume it's just
  unread.
- **Local tooling (mem0/gh/graphify CLIs) was missing on this machine** as of
  2026-08-11 and got installed mid-session: `gh` via winget (`--scope user`,
  see the winget skill below), `@mem0/cli` via npm, `graphifyy` via pip
  (`--user`, since no `uv` on this machine — scripts land in
  `%APPDATA%\Roaming\Python\Python312\Scripts` /
  `%LOCALAPPDATA%\Microsoft\WinGet\Packages\GitHub.cli_.../bin`, both added
  to user PATH — **a brand-new shell picks this up; the shell running mid-
  session did not** and needed `$env:PATH`/`$PATH` appended manually each
  call). **`mem0` still needs auth** — a key was supplied this session but
  failed (`sk-...` prefix, wrong format; Mem0 keys are `m0-...`) — get the
  correct key from https://app.mem0.ai/dashboard/api-keys, then `mem0 init
  --api-key <key>`. **`gh` still needs `gh auth login`** (interactive) — not
  blocking today since the remote's already configured and pushed.
- **`winget-machine-scope-uac-hang-noninteractive`** (global skill) — the
  `gh` install above hung on a UAC prompt no automated shell can answer;
  fix is `--scope user`. Applies to any `winget install` from an automated
  context, not just `gh`.

- **The `handoff-before-clear` skill is now half-installed** (re-verified
  2026-09-02; the 2026-08-21 note said neither half existed).
  - `~\.claude\commands\handoff.md` **does exist** (dated 2026-08-27), so
    **`/handoff` works**. The older claim that `~\.claude\commands\` was
    missing entirely is obsolete — it was created six days after that check.
  - The safety net is **still not built**: there is no
    `~\.claude\hooks\handoff-stale-on-clear.py`, and the only
    `SessionStart` hook in `~\.claude\settings.json` is
    `bridge-session-start.py` with **no `matcher`**.
  - Net effect: run `/handoff` yourself before `/clear` — **nothing warns
    you** if you skip it. Neither piece can trigger `/clear`; that stays a
    manual second step either way.

## Working conventions

Fast model for cheap/mechanical tasks: formatting, boilerplate, simple
refactors, README/CLAUDE.md edits → prefer a lighter/faster model or a
Haiku-class subagent. Reserve full-effort reasoning for schema/architecture
decisions, external API integrations, and anything touching money math or
auth. Promote a task pattern to a `.claude/skills/` skill once it repeats
2-3+ times instead of re-deriving it each time. Exploration and lookups that
touch many files go to a subagent (e.g. haiku-lookup) so large tool output
never lands in the main window; only the summary comes back.

Problems, bugs, and reusable feature patterns get extracted to a global
skill under `~/.claude/skills/`, not written as prose in this file. This
file keeps only a short pointer per skill — why it exists, what it's for,
when to use it. See the `new-project-bootstrap` skill's Step 7 for the full
workflow and the reusability test.

Before starting or continuing work, check for an existing skill first —
skim the available-skills listing and this file's pointer lines under
Known environment gotchas / Working conventions before re-deriving a fix or
re-researching a pattern.

**Reach for the shared pieces before writing a new one.** These exist
because the same thing had already been hand-rolled 2-4 times:
`components/data-table/data-table.tsx` (the whole sortable/filterable/
paginated table — pass `columns` + optionally `globalFilterFn`),
`components/toggle-button.tsx` (grid toggles, over shadcn `Button`),
`features/shifts/components/shift-swatch.tsx` (the coloured shift dot —
owns the badge-colour lookup; replaced eight hand-rolled copies),
`lib/id.ts#generateId`, `lib/time.ts#toMinutes`, `lib/plural.ts#plural`. And use the shadcn
primitives (`Button`/`Input`/`Label`/`FormMessage`) rather than styling a
raw element — several raw ones in this repo carried *stale copies* of the
primitive's class string.

**Typecheck with `npm run build`, not `tsc --noEmit -p tsconfig.json`.**
The latter silently misses errors here (project references) — it passed on
a genuine missing-import that `tsc -b` caught.

- **`graphify`** (global skill) — turns this repo into a queryable knowledge
  graph (community detection, `query`/`path`/`explain`). Built this session:
  1,386 nodes / 3,690 edges / 142 communities, in `graphify-out/`
  (gitignored, generated). **Query it before grep-and-read** for any "where
  is X / what depends on Y" question — `graphify query "<question>"` (needs
  `graphify-out/.graphify_python` present; PATH note below).

- **`react-compiler-rejects-manual-usememo`** (global skill) — extracted
  2026-09-12. With the React Compiler on, a hand-written `useMemo` can trip
  `react-hooks/preserve-manual-memoization`, which is an **error** and makes
  the compiler skip optimizing the **whole component**. Delete the memo rather
  than tuning its deps or disabling the rule; `eslint` is the only thing that
  catches it. Bit `schedule-rotation/index.tsx`.

- **`radix-select-bubble-select-wipes-programmatic-value`** (global skill) —
  extracted 2026-08-21 from a real bug in this repo's rotate
  "Custom alternate" step. A Radix `Select` whose value is set *by code*
  (effect default, `useFieldArray.replace`, `setValue`) can have it wiped
  back to `""` a frame later by Radix's hidden form-participation
  `<select>`. Guard lives in `src/components/recurrence-frequency-fields.tsx`.
  Read it before touching any Select that gets populated programmatically.

## Session state (2026-08-11)

- Reconstructed this CLAUDE.md from scratch — it existed conceptually
  (referenced by `docs/FEATURE_MAPPING.md`, excluded via `.gitignore`) but
  was missing on this machine. Grounded in `docs/ARCHITECTURE.md`,
  `docs/FEATURE_MAPPING.md`, and `package.json`.
  Ran via the `new-project-bootstrap` skill, adapted for an existing project
  (git/README/remote already set up — did not re-scaffold those).
- Installed missing local tooling: `gh` CLI (winget --scope user, hit and
  fixed a UAC hang — see gotcha/skill above), `@mem0/cli` (npm), `graphifyy`
  (pip --user). `graphify install --platform claude` re-synced the global
  graphify skill from 0.9.29 → 0.9.40.
- Extracted a new global skill:
  `winget-machine-scope-uac-hang-noninteractive`.
- Mem0 cross-project search (bootstrap Step 1) was **not run** — CLI
  installed but authentication failed (wrong key format supplied). Still
  unresolved.
- **Ran the full graphify pipeline against this repo** (`graphify-out/`,
  gitignored): 307 files / ~82.7k words detected → 1,386 nodes, 3,690 edges,
  142 communities, all labeled. Health check flagged 509 dangling-endpoint +
  ~90 collapsed edges (expected — external/library symbols not modeled as
  nodes, e.g. React/Radix internals); not a corruption, just a known
  AST-extraction boundary. Outputs: `graph.html` (open directly, no server),
  `GRAPH_REPORT.md`, `graph.json`.
  - God nodes: `cn()` (274 edges), `Button()` (63), `showSubmittedData()`
    (35), `FileRoutesByPath` (35), plus the `FormItem/FormLabel/FormField/
    FormControl/FormMessage/Input` cluster (27-30 each) — the expected
    Shadcn/react-hook-form primitives sitting at the center of the app.
  - Surprising connections: mostly docs (ARCHITECTURE.md/FEATURE_MAPPING.md/
    README.md/CHANGELOG.md) independently describing the same features
    (Clerk auth, RTL support) — confirms the docs aren't drifting from each
    other. One real finding worth a look: `index.html`'s Open Graph/Twitter
    meta tags are still hardcoded to `shadcn-admin.netlify.app`, inconsistent
    with the actual GitHub Pages deploy target in
    `.github/workflows/deploy-pages.yml` (flagged AMBIGUOUS, not fixed).
  - No import cycles detected.

## Session state (2026-08-16)

- Confirmed `opencode-agents-bridge` is installed locally and resolved the
  prior "not installed" gotcha (see above) — no recreation needed.
- Found the `D:\skills` backup drive is currently mounted as `E:\skills`;
  same content, cross-machine (see gotcha above). Diffed it against local
  `~/.claude/skills` by content hash: nothing on the drive was newer, so no
  pull was needed. Local was ahead on two things the drive didn't have —
  the newer `opencode-agents-bridge/assets/bridge-template/scripts/
  Watch-Agent.ps1`, and the whole `winget-machine-scope-uac-hang-
  noninteractive` skill — **pushed to `E:\skills` this session** (confirmed
  first, then copied + logged a manual entry in
  `E:\skills\.sync-log.jsonl`/`LAST-SYNC.txt` in the same format
  `Sync-Bootstrap-Assets.ps1` uses, attributed to `abbas@KENJI-LAPTOP` since
  that script itself isn't present on this machine). Re-hashed after:
  local and `E:\skills` are now fully identical, 31 folders each.

## Session state (2026-08-21)

- Schedule-form UI batch (monthly disabled everywhere, rotate drag-and-drop
  hint, compacted Summary step, sidebar Shift management rename) plus the
  Radix Select bug above. Complete and verified in a real browser.
  **Shipped 2026-08-22 in `d43c79d`** (folded into the shift-policies
  commit — the two overlap in six files). → Full state and decisions:
  `.claude/handoff/schedule-form-ui-polish.md`
- Found **repo-wide Prettier drift**: ~67 files fail `prettier --check` at
  HEAD (plugin/version change in tailwind class sorting + import order).
  Only the files touched this session were formatted, deliberately — so
  several diffs mix formatting churn with real changes. **Review with
  `git diff -w`.** Whether to normalize the whole repo in one separate
  commit is still an open call.
- `src/context/search-provider.test.tsx` has **3 pre-existing failures**
  (confirmed by stashing this session's changes and re-running). Unowned,
  unrelated to the schedule form.
- The `handoff-before-clear` skill's own machinery is **not installed on
  this machine** — see the gotcha under Known environment gotchas.

## Session state (2026-08-22)

- **Shift policies are now first-class records**, not three hardcoded
  presets: a new `src/features/shift-policies/` feature (schema, seeded
  zustand store on `localStorage` key `"shift-policies"`, dialog, table,
  screen at `/shift-policies`), attached to a shift by
  `policy_ids: string[]`. The old `policy_type` enum,
  `SHIFT_POLICY_DETAILS`, `policy-select-field.tsx` and
  `policy-pill-field.tsx` are **deleted**; the shifts table column and the
  row-menu drawer both read the new records. Also added Full Day / Half
  Day duration fields to the Shift times tab.
  → Full model, decisions and follow-ups: `.claude/handoff/shift-policies.md`
- Shared extractions in the same pass — see Working conventions above:
  one `DataTable`, `ToggleButton`, `lib/id.ts`, `lib/time.ts`, and the
  policy dialog split into a form shell + `policy-rules-field.tsx`.
- **Shipped as one commit, `d43c79d`, pushed to `main`** (60 files,
  +2280/−1033), carrying the 2026-08-21 work with it.
- **Not browser-verified.** No browser tooling that session; the
  `ToggleButton` swap across the schedule-form grids is the risky part.
- Tests now **161 passed / 3 failed** — the 3 are still the unowned,
  pre-existing `search-provider.test.tsx` failures.

## Session state (2026-08-22, later)

- **Pulled three screens over from the sibling `../schedule-feature`
  checkout** (`7e3450a`, same owner, different repo, branch `mahmoud-main`):
  `employees` (add/edit form, sidebar tabs), `employees-list` (table over
  seeded JSON) and `official-holidays` (per-year records, open-year
  seeding, bulk delete, faceted filter). Routes at `/employees`,
  `/employees-list`, `/official-holidays`; sidebar gained **Employees**
  and **Holidays**. No new dependencies — the two repos' deps are
  identical and every shared module these import is byte-identical.
  → Full state, the porting fixes, and two open calls (no persistence /
  no zustand; both tables bypass the shared `DataTable`):
  `.claude/handoff/employees-and-holidays-screens.md`
- **Shipped as two commits pushed to `main`**: `efb71a0` (the
  shift-policies UI batch that had been sitting uncommitted — 24-hour rule
  times, policy search dropdown, shift `start_date`) and `7e3450a` (the
  three screens above).
- `npm run build` clean; tests 164 passed / 3 failed (still only the
  pre-existing `search-provider.test.tsx` failures). **Neither batch has
  been verified in a real browser.**

## Session state (2026-08-26)

- **Schedule Rotation screen seed data + naming.** The screen at
  `/schedule-rotation` (built 2026-08-25) went from one demo rotation to
  **four, each covering a different case** of the rotate model — one
  shift per position, a block pattern (repeated positions → fewer crews
  than positions), `custom_shifts` / "Custom alternate" driven by
  `shift_repeat` intervals, and a monthly-read on-call cycle — plus the
  **eight new shifts** carrying their employee/team assignments (the
  rotation roster is derived from each pattern shift's Assign-to picks,
  so that's where the people live).
- **Renamed "Shift Rotation" → "Schedule Rotation"** everywhere
  user-visible (page `<h2>`, both sidebar entries) and in the code
  comments naming the screen. Route + feature dir were already
  `schedule-rotation`. Also added a **top-level sidebar button**
  (`RotateCw`) — so two sidebar entries now point at that route.
- `npm run build` clean; all four rotations validated against the real
  zod schemas and stepped through consecutive periods. **Full suite not
  run** — vitest browser mode can't bind its port on this machine
  (`EACCES ::1:63315`); workaround + everything else:
  → `.claude/handoff/schedule-rotation-screen.md`
- Still **uncommitted**, and still **not browser-verified**.

## Session state (2026-08-26, later)

- **Pulled the last two screens from `../schedule-feature` @
  `mahmoud-branch`** (`a37ebb5` publicHoliday + the three ScheduleTemp
  commits) and rewrote them onto this repo's conventions — zustand +
  `localStorage` stores, the shared `DataTable`, snake_case schema fields,
  `lib/id.ts` / `lib/time.ts`, `Badge` variants instead of raw Tailwind
  palette maps, `useTimeFormat` for clock strings, row-action dropdowns.
  - **`public-holidays` replaces `official-holidays`** — their commit was
    itself a rename+rework of that screen (`rigid` → `fixed`), so the old
    feature + route are **deleted** and the sidebar entry now points at
    `/public-holidays`. Their calendar multi-select UX was kept; our bulk
    delete was kept (theirs had dropped it) and now actually deletes.
  - **`schedule-templates`** is their "Schedule Temp", renamed to avoid
    colliding with `schedules`' own `temporary_schedule` boolean.
    Sidebar: Time Track → Schedules → Schedule templates.
  - **The shared `DataTable` gained `searchKey`, `filters` and a
    `bulkActions` render prop** (plus faceted row models), which is what
    let both screens drop their hand-rolled table markup. Additive — the
    three existing tables are unaffected.
  → Full adaptation table, the two bugs fixed on the way in, and the
  deliberate deviations: `.claude/handoff/public-holidays-and-schedule-templates.md`
- `npm run build` clean, `eslint` clean on the new code, tests 60 passed /
  3 failed (the 3 are `--environment=node` artifacts, not real). Still
  **uncommitted** and **not browser-verified**.

## Session state (2026-08-27)

- **Committed and pushed everything that had piled up uncommitted** — the
  working tree at session start held the full 2026-08-26 batches above
  *plus* two features neither session state nor any handoff file had ever
  recorded: a **Team Management** screen (`/teams`) and shift-form
  **Assign-to Employees/Teams pickers** (`employee_ids`/`team_ids` on the
  shift schema), both already built, just never surfaced. No new feature
  code was written this session — the work was reading every diff to
  recover the real dependency order, then landing it as 9 commits instead
  of one undifferentiated dump:
  `e99abb4` (employees form + `employees-list` DataTable migration, a
  dependency of teams) → `d808701` (teams) → `c8c333c` + `ca6ad08` (shifts
  assign-to, depends on teams+employees) → `783b18b` (shift-policies
  holiday-work rule, independent) → `7ae79da` (Schedule Rotation, depends
  on all of the above) → `d054452` (public-holidays + schedule-templates)
  → `3752211` (this file) → `525da2d` (routeTree regen). Pushed to `main`.
  New handoff: `.claude/handoff/teams-and-shift-assignment.md`.
- `npm run build` clean; **full suite ran in real browser mode** (no
  workaround needed) — **174 passed / 3 failed**, the 3 being the
  pre-existing unowned `search-provider.test.tsx` failures. This
  supersedes the partial `--environment=node` numbers recorded in the two
  sessions above, which were working around a vitest port-bind error
  (`EACCES ::1:63315`) that did **not** reproduce this session — see the
  affected handoff files for detail; treat that workaround as a fallback,
  not the default, until/unless it recurs.
- `eslint` re-checked: still 11 errors / 3 warnings, same 5 files as the
  2026-08-26 handoff recorded — confirmed stable, not drifting.
- Updated the four handoff files this session's commits touched
  (`employees-and-holidays-screens.md`, `shift-policies.md`,
  `schedule-rotation-screen.md`, `public-holidays-and-schedule-templates.md`)
  to strike resolved blockers and correct now-stale "uncommitted" /
  vitest-gotcha claims. `schedule-form-ui-polish.md` untouched — out of
  scope.
- **Still not browser-verified** — this session organized and verified
  the build/test pipeline only, no browser tooling was used.

## Session state (2026-09-02)

- **Rotate schedules now suggest their own crew assignment.** New pure
  module `src/features/schedules/rotation-suggestion.ts` picks each crew's
  starting position by searching for the offsets that flatten coverage
  (exhaustive under 100k combinations, seeded local search above), then
  grades the result. The form's "Assign to" step gained a crew pool +
  "Suggest assignment" button and a live coverage grid; a 14-preset library
  (`data/rotation-presets.ts`) covers the named systems — 2-2-3 Panama,
  Pitman, DuPont, Southern Swing, Metropolitan, 4-4, 5-2 and the rest.
  → `.claude/handoff/rotation-suggestion.md`
- **Two model additions, both backward-compatible.** `RotationPeriodType`
  gained **`daily`**, so a day-based pattern advances one card per day
  (without it a 14-card 2-2-3 described a 14-*week* cycle). And
  `pattern[].crew_shift_id` optionally pins a crew to one shift, which is
  the only way a shared pattern can express fixed-shift crews — over one
  cycle every crew otherwise visits every card. Unset = exactly the old
  behaviour.
- **Watch out for the "understaffed" trap** if this area is touched again:
  "fewer crews than cycle days" is *not* understaffing, and coding it that
  way flags a textbook 4-crew Panama roster as broken. Warning severity is
  decided by **fixability** (would reassigning help?), not by outcome —
  an office 5-2 leaves two days empty by design. Regression test named for it.
- **The step's UI was reworked after first review.** Suggesting is now the
  default path and hand-assignment sits behind an "Assign manually" toggle,
  laid out as one card per cycle day mirroring the Pattern step — shift
  shown as a *disabled* field, crew as the live dropdown, and only one crew
  kind (Teams **or** Employees) offered at a time.
- **The coverage panel's warning list is computed but no longer rendered.**
  It emitted one near-identical line per shift without naming which shift,
  so a 2-crew roster produced three near-identical paragraphs. `warnings`
  stays in `analyzeRotation`'s API and tests — **rewrite the messages
  before ever re-displaying them.**
- **New vitest gotcha: `optimizeDeps.include`.** A dep discovered *mid-run*
  (here `@radix-ui/react-switch`) makes vitest reload and briefly resolve a
  second React — `Invalid hook call`, but only against a cold
  `node_modules/.vite`, and with the same signature as the `resolve.dedupe`
  issue already documented. Anything a component test mounts that
  `src/main.tsx` does not reach belongs in that list.
- Third seed added, `sched-panama-223`; **`SEED_VERSION` bumped** to
  `'2026-09-02-rotation-suggestion'`.
- `npm run build` clean; `npm run test` **224 passed / 3 failed** (the same
  unowned `search-provider.test.tsx` three); `eslint` **0 errors** / 3
  pre-existing warnings across the touched features. **Still not
  browser-verified — no browser tooling in the session — and uncommitted.
  The day-card grid is the newest markup and the least verified.**

## Session state (2026-09-03)

- **Three corrections to the rotate "Assign to" step**, all reported from a
  real screenshot of a 5-2 pattern run by two crews. No new feature work.
  1. **The suggestion was trading away a whole day of coverage.**
     `scoreOffsets` weighted per-shift smoothness ×2 against on-duty
     variance, so `{1,2}` (coverage `[2,2,2,1,0,1,2]` — *nobody in* on day
     5) beat `{0,3}` (`[2,2,1,1,2,1,1]`) on cost, 8.86 vs 10.86. A day
     nobody works is now priced above everything else the score can reach
     (`emptyDayPenalty`, a computed bound rather than a magic constant).
     **This does not undo the "understaffed" rule** from 09-02: an
     unfillable gap is paid for equally by every candidate, so a constant
     cannot change which is smallest. Both halves have named tests.
  2. **"Next" now accepts the step.** Pressing *Suggest* always wrote
     straight into `pattern[]` (verified by driving the whole wizard in
     Chromium, not assumed) — but picking a pool and *not* pressing it, or
     changing the pool afterwards, advanced with a roster that did not
     match the selection. `commitPendingSuggestion` closes both, and skips
     manual mode entirely so hand-placed crew is never re-searched.
  3. **The Summary was under-reporting the roster** — it listed stored
     positions, so two crews on a seven-card week read as five dashes. It
     now repeats the step's coverage grid and lists only the positions
     someone starts on. Forced a shared `rotation-crews.ts`, which keeps
     `rotation-suggestion.ts` schema-free.
- **Pre-existing bug found by a new test:** flipping Teams ⇄ Employees with
  the manual grid open copied employee ids into `team_ids` — RHF
  re-registers a controller under a changed `name` while it still holds the
  old value. Fixed with `key={crewField}`. **Any `FormField` whose `name`
  comes from state needs that key.**
- **The `optimizeDeps` gotcha recurred exactly as the handoff predicted**,
  the first time a test mounted the whole `ScheduleForm`;
  `@radix-ui/react-popover` added to the list.
- `npm run build` clean; `npm run test` **229 passed / 3 failed** (the same
  unowned `search-provider.test.tsx` three); eslint clean on every touched
  file. **Still uncommitted — now two sessions' worth — and still not
  browser-verified by hand.**
  → `.claude/handoff/rotation-suggestion.md`

## Session state (2026-09-06)

- **The rotate pattern stopped deciding which shifts run each day.** It is
  now a *template* — one crew's journey through the cycle ("Morning,
  Morning, off, Afternoon") — and `shift_ids` decides what has to run:
  **every selected shift, every day**. The unlock is one new degree of
  freedom per crew, `shiftStep`, which transposes its journey through the
  shift list (ordered by **start time**) on top of the existing
  `dayOffset`. Before this, an all-Morning 5-2 pattern could never staff
  Night however many crews you added — every crew visits every card, and
  every card said Morning.
- **Schema break, deliberate.** `rotatePatternEntrySchema` lost
  `employee_ids`, `team_ids` **and** `crew_shift_id`; the rotate branch
  gained **`day_coverage`**, a sparse `(cycle day × shift) → crews`
  matrix. That shape is forced by the user's choice of **free cell
  editing** in the manual grid — no pair of offsets can express an
  arbitrary cell edit, so offsets now live only *inside* the search.
  Saved schedules still load (zod strips the dead keys) but come back with
  an empty roster; `SEED_VERSION` → `'2026-09-06-day-coverage-matrix'`.
- **Watch out: the search needs multiple starts.** Seeding only
  round-robin shift steps *loses to plain even spacing* on DuPont and
  DDNNOO, which already encode their own day/night alternation and want
  every step at 0. It now starts from all-zero steps, round-robin, a
  greedy construction, and the exhaustive day pass per step seed, then
  hill-climbs each. Four tests caught this; don't simplify it back.
- **An arithmetic trap worth remembering:** 2 crews on a 5-2 with 2 shifts
  is 10 crew-days for 14 cells — **4 cells must stay empty**. "No red 0"
  needs **4** crews. The 09-02 understaffed-trap rule is unchanged and
  still load-bearing: severity is decided by fixability
  (`crewDays >= cycleLength × shiftCount`), never by outcome.
- **The warning list is rendered again**, which is the rewrite the 09-02
  note asked for — messages now name the shift. It has to be visible: an
  unstaffed shift is a warning, never a validation error (user's call:
  *warn, don't block*), so the coverage panel is the only place it is
  reported. New `crew-double-booked` warning, reachable only by hand.
- `npm run build` clean; `npm run test` **243 passed / 3 failed** (the same
  unowned `search-provider.test.tsx` three); eslint **0 errors** / 3
  pre-existing warnings. **Still uncommitted — now three sessions' worth —
  and still not browser-verified: no browser tooling in this session
  either.**
  → `.claude/handoff/rotation-suggestion.md`

## Session state (2026-09-08)

- **Analysis only — no code written, nothing changed in `src/`.** The user
  pasted four real-world rotation write-ups (4-crew 2-2-3 Panama with team
  day-offsets; a 4-team/3-shift 28-day weekly forward rotation; a 7-week /
  49-day master rotation; a 4-week healthcare 5/2 with forward-rotation,
  weekend-equity and skill-mix guardrails) and asked whether our rotate model
  already implements them.
- **Answer: the patterns themselves already work** — all four are expressible
  as day-card patterns, and `choosePlacement`'s *first* search seed
  (`evenSpacedOffsets` × all-zero shift steps) is exactly the 0/7/14/21 stagger
  those week-block templates want. "Repeat indefinitely every 28 days" is
  `end_settings: never` on a 28-card pattern.
- **Four real gaps found.** (1) **Crew start offset is not a concept** —
  `dayOffset`/`shiftStep` live only inside the search and are discarded into
  `day_coverage`, so nothing can say or read back "Team B starts Week 2"; every
  one of the four write-ups is built on exactly that. (2) No forward-rotation /
  minimum-rest guardrail — nothing flags Night → Morning on consecutive days.
  (3) The `weekday-anchor` / `weekday-drift` warnings **are computed and then
  hidden** by the panel's `severity !== 'info'` filter, and `schedule-summary.tsx`
  passes no `startDate` at all — so the user's "align the start date with day
  one" rule is invisible. (4) Three of the four templates have no preset.
  Skill-mix was judged out of scope (it's about team *composition*).
- **Three scope questions were asked and not answered** before the session was
  closed — how far to take persisted crew offsets, which guardrails to build,
  and whether to add the three presets. **Ask them again before writing code.**
  → `.claude/handoff/rotation-crew-offsets-and-guardrails.md`

## Session state (2026-09-10)

- **Crew start days are a real, editable, persisted field.** The 09-08 scope
  questions were answered — persist + editable, all three presets, guardrails
  delegated — and built. `rotateFieldsSchema` gained **`crew_placements[]`**
  (`crew` key + `day_offset` + `shift_step`), which is the "Team B starts on
  week 2" sentence every real-world rotation is written in. **`day_coverage`
  is still the source of truth**; placements are a generator record beside it,
  so the 09-06 free-cell-editing model is untouched. Surfaced three places:
  an editor on the "Assign to" step, a read-back on Summary, and a per-employee
  line on `/schedule-rotation`.
- **Staleness is re-derived, never flagged.** `dayCoverageMatchesPlacements`
  regenerates cells from the offsets and compares. A `stale` boolean would have
  to be cleared on every path that touches a cell, and the one path that
  forgets makes the record lie. After a hand edit every screen shows the matrix
  and says the start days no longer describe it — and **nothing re-applies
  them**.
- **Watch out: the rest guardrail has to be measured in hours, not list
  positions.** Shifts are ordered by start time, so Night → Morning steps one
  place *forward* through the list while being the textbook quick turnaround
  (off at 06:00, back on at 06:00). A rule written on `orderedShiftIds` indices
  waves through the one transition it exists to catch. `shiftHoursById` gives
  real clock spans, pushing an overnight end past 1440 so
  `1440 + nextStart − prevEnd` lands on zero instead of going negative. New
  `quick-turnaround` warning — one line, not one per occurrence.
- **Forward rotation is in the scorer as a tie-break only** (`1e-3` per
  offence) and **gated on `shiftHours` being supplied**, so every pre-existing
  test scores identically by construction. No rebaselining was needed and none
  was done. Weekend-equity scoring was deliberately deferred: stacking two new
  scoring terms at once makes a regression unattributable.
- **The alignment warnings are visible at last.** `weekday-anchor` /
  `weekday-drift` were computed and then filtered out by the coverage panel,
  and `schedule-summary.tsx` was passing **no** `startDate` *or* `shiftHours` —
  so weekday, weekend and rest warnings were all silently absent there while
  showing on "Assign to".
- **Three presets added** — `weekly_forward_28`, `master_49`,
  `healthcare_five_two`. Two caveats worth carrying: the healthcare write-up's
  fourth week was transcribed as **8 cards** in the 09-08 notes (impossible for
  a 28-day cycle — built as 7, confirm against the source), and **`master_49`
  cannot be flat**: 210 crew-days over 49 days is a mean of 4.29, so the
  library's ≤1 on-duty spread is arithmetically out of reach. Recorded as a
  commented exception in the test rather than by loosening the rule for all
  fifteen presets.
- **No migration.** `crew_placements` defaults to `[]`, so saved schedules load
  fine and read as "set by hand". **`SEED_VERSION` not bumped.** The eight
  rotate seeds carry `[]` — their real offsets were never recorded, so **no
  seeded rotation demonstrates the start-day read-back yet**.
- **Shipped and pushed**, clearing four sessions' worth of uncommitted work:
  `7c9cb5a` (crew start days, rest guardrail, three presets) and `4531085`
  (the crew-requirement explanation below). Working tree clean.
- **The "why does a 2-shift rotation need 4 teams?" question got a real
  answer**, and it is worth not re-deriving. A plain 5-on/2-off needs ≥2 crews
  on duty every day (14 crew-days) against 3 crews × 5 days = 15, so at most
  one crew is off per day — which makes all three *pairs* of crews share duty,
  and each pair must be on opposite shifts. A pattern naming one shift
  throughout welds each crew to one shift, so that needs three pairwise-
  different values out of two shifts. Impossible → 4. `five_two` is
  single-shift by design; the shift count is not what forces it.
- **Watch out: "just alternate the shifts" is not a rule.** A sweep over cycle
  lengths 4-12 across 2 and 3 shifts found **55 counterexamples** — alternating
  rescues the 7-day 5-2 (4 → 3) and *ruins* the 6-day two-block roster (3 → 4).
  It had already been written into the UI copy as advice before being tested.
  Two named tests pin both directions.
- `npm run build` clean; `npm run test` **272 passed / 3 failed** (up from
  243/3 — the same unowned `search-provider.test.tsx` three); eslint **0
  errors** / 3 pre-existing warnings. **Still not browser-verified — five
  sessions now — and the crew-start editor, the Summary read-back and the
  `/schedule-rotation` crew line are markup nobody has loaded.**
  → `.claude/handoff/rotation-crew-offsets-and-guardrails.md`

## Session state (2026-09-11)

- **Repo-wide refactor + cleanup pass, no behaviour change to the rotate
  model.** `npm run build` clean, `npm run test` **340 passed / 0 failed**
  (from 272/3), eslint unchanged at 11/3.
- **The three long-standing `search-provider.test.tsx` failures are fixed,
  and they were never flaky** — they asserted `Dashboard`, `Tasks` and
  `Settings Account`, all of which had been commented out of
  `sidebar-data.ts`. Fixing them surfaced a **real bug**: `command-menu.tsx`
  walked only *two* levels of the nav while the sidebar is *three* deep, so
  every nested palette entry called `navigate({ to: undefined })`. It now
  flattens the tree recursively to its leaves.
- **The rotation search is ~12× faster** on the search-heavy suite (2.21s →
  0.18s of test time) with identical output. Every journey the pattern
  admits is precomputed into an `Int16Array` once per search; quick
  turnarounds are a per-crew property so they are precomputed too; the hill
  climb mutates in place and rolls back instead of cloning two arrays per
  trial. No scoring rule changed.
- **Deleted the template demo modules** — `users`, `tasks`, `chats`, `apps`,
  `dashboard`, the `help-center` route, the whole `routes/clerk/**` tree,
  `top-nav.tsx`, `coming-soon.tsx`, 14 unused brand icons, the dead
  `schedules/components/schedule-form/{badge-color,icon-picker}-field.tsx`,
  and the deps `@clerk/react`, `recharts`, `@faker-js/faker`. `/` now
  redirects to `/schedules`. **`POS` is still in the sidebar pointing at
  `#`** — left alone deliberately, it looks like a roadmap placeholder
  rather than template boilerplate.
- **New: `docs/ROTATION_ALGORITHM.md`** — the model, the scoring order, the
  search seeds, every warning, the measured preset coverage table, and an
  explicit list of what is *not* covered (weekend-equity scoring, skill mix,
  leave/availability, monthly repeat rules, per-day headcount targets).
  Every number in it is computed by `schedules/doc-examples.test.ts`, so the
  doc fails the build rather than drifting.
- **Found and corrected a wrong preset description:** `healthcare_five_two`
  claimed it "leaves nights uncovered on one cycle day". It actually leaves
  **16 cells** uncovered at its suggested 4 crews and needs **7** — 19 work
  days × 4 crews is 76 crew-days against 84 cells.
- New tests: `schedules/data/schema.test.ts` (33 — the rotate branch's
  cross-field rules had no coverage at all),
  `schedules/data/rotation-presets.test.ts` (12),
  `schedules/doc-examples.test.ts` (24), plus additions to
  `schedules/utils.test.ts`, `rotation-crews.test.ts`,
  `schedule-rotation/utils.test.ts` and a new `lib/plural.test.ts`.
- The three `schedule-form.test.tsx` wizard tests now carry an explicit
  45s timeout — they take ~14s alone and were flaking against vitest's
  15s default under a loaded full-suite run.
- **Still not browser-verified** — no browser tooling this session either.
- **Moved crew assignment out of the schedule wizard, onto Schedule
  Rotation.** The wizard's "Assign to" step (step 4 of 6, rotate only) is
  gone — rotate is now a 5-step wizard (`basics → shifts → pattern →
  end-settings → summary`), and a new standalone page,
  `/schedule-rotation/assign` (`schedule-rotation/pages/assign/
  schedule-rotation-assign-page.tsx`), does the assignment instead: pick
  any existing rotate schedule (assigned or not — same screen handles
  first-time assignment and later re-edit) from a dropdown, then the exact
  same `ScheduleAssignToFields` component, unchanged, mounted in its own
  small form. Reached via a new "Assign crews" button on
  `/schedule-rotation`. **Why**: staffing a schedule no longer has to
  happen *during* creation, before the record even exists, and this
  feature already existed purely to *display* the roster — the natural
  place to *set* it too.
- **Also added "Start & End" (start date + end frequency) to that same new
  page**, reusing `schedule-start-end-fields.tsx` unchanged — so it's now
  the one place to fully manage an existing rotate schedule's roster and
  scheduling window without going back through the wizard.
- **Wizard Summary + the read-only View page** both used to show the full
  coverage panel for a rotate schedule; both now show a one-line status
  note ("Not yet assigned…" / "N crews assigned…") pointing at Schedule
  Rotation, via a new shared `assign-to-status-note.tsx`. The View page
  needed its own small carve-out for this, since it renders every wizard
  section via a `disabled ||` pattern but `ScheduleSummary` (which carries
  the note) doesn't render at all in disabled mode.
- **No schema/data migration** — `day_coverage`/`crew_placements` already
  defaulted to `[]` and are validated as optional/warning-only, so nothing
  about stored shape changed; `SEED_VERSION` not bumped.
- `schedule-form.test.tsx` (nothing but the wizard-seam rotate-assignment
  suite) **deleted outright**; its 3 seam tests moved to a new colocated
  `schedule-rotation-assign-page.test.tsx` driving "Save" instead of
  "Next"; its 4th test was already redundant with `scenario.test.ts`'s
  general loop and wasn't re-added. Two more tests added for the new
  Start & End fields.
- New vitest gotcha hit and fixed the same way as before: the new page's
  test mounting `ScheduleStartEndFields`'s date picker for the first time
  discovered `react-day-picker` mid-run — added to `vite.config.ts`'s
  `optimizeDeps.include`.
- `npm run build` clean; `npx eslint .` unchanged from the documented
  baseline (11 errors / 3 warnings, none in touched files); `npm run test`
  **273 passed / 3 failed** (up from 272/3 — same unowned
  `search-provider.test.tsx` three). **Still not browser-verified** — the
  new page and its "Save" round-trip are the newest, least-verified
  markup; see the updated click-path in
  `.claude/handoff/rotation-suggestion.md`'s Open calls.
  → `.claude/handoff/schedule-rotation-screen.md`,
  `.claude/handoff/rotation-suggestion.md`

## Session state (2026-09-12)

- **Reconciled a real divergence first.** The local checkout was **5 commits
  behind `origin/main`** (which is what GitHub Pages serves) while holding the
  whole uncommitted 09-11 cleanup batch. Both sides had moved rotate's crew
  assignment in **opposite directions**: local dropped the wizard's
  "Start & End" step and kept "Assign to"; the remote dropped "Assign to" and
  kept "Start & End", moving assignment to `/schedule-rotation/assign`. The
  remote won — `schedule-form.tsx`, `schedule-summary.tsx` and
  `schedule-rotation/index.tsx` were taken wholesale, `schedule-form.test.tsx`
  stayed deleted, and the local `rotation-dates-dialog` was deleted as
  superseded. Only 8 files conflicted. `bridge/` is now **gitignored** — it is
  pure runtime state and got swept into a commit by `git add -A` once.
- **Crew assignment is a dialog, not a screen.** `/schedule-rotation/assign`
  and `pages/assign/` are gone; `components/assign-crews-dialog.tsx` holds the
  same `AssignToPanel` (unchanged apart from closing instead of navigating).
  The picker groups schedules "Not assigned" / "Assigned" and **defaults to the
  first unassigned one**, falling back to the schedule being viewed.
  **Watch out: every rotate seed is staffed**, so with seed data the dialog
  always opens on the fallback — a test asserted otherwise and correctly failed
  until it built its own unstaffed schedule.
- **The timeline starts where the schedule and each crew do.** Days before
  `start_date` are dropped, Previous is disabled at that boundary, and each
  crew row is blank until its own first working day — an **empty spacer, not
  the off-day ring**, since "not on this rotation yet" and "rostered and
  resting" are different statements. `daysOn` no longer credits a late crew for
  time before it existed. Each crew's start date reads under its name.
  Crew start dates are found by **walking forward through `getPeriodIndex`**
  rather than re-deriving the date arithmetic — duplicating it is how the two
  would drift.
- **Each view owns its period tabs**, both seeded from `getDefaultSpan`
  (`cycle_length.unit`, falling back to pattern length for `custom_days`) and
  re-seeded when the schedule changes. Over the Employees table they filter
  rows to people working that week/month; somebody the matrix never mentions
  stays listed rather than vanishing.
- **New `FilterableMultiSelect`** — an A-Z strip over `MultiSelect`, on both
  assign-flow pickers. It narrows `options` only: react-select takes `value`
  separately, so a chip already picked survives a letter that excludes it
  (named test). `onLetterChange` is there for a future server-side query.
- **Shift form trimmed** to General / Shift times / Shift policy, and Shift
  times lost its Start date field. Nothing deleted from the schema; the tab
  components stay parked. Corrected two comments that still claimed Schedule
  Rotation reads a shift's `employee_ids`/`team_ids` — it has not since
  2026-08-29.
- **Watch out: the React Compiler rejects manual `useMemo`** in
  `schedule-rotation/index.tsx`. Two derivations there are plain functions on
  purpose — do not "optimize" them back. Extracted to the
  `react-compiler-rejects-manual-usememo` skill.
- **BROWSER-VERIFIED AT LAST** — the first time in this repo. Drove the real
  dev server with Playwright directly (no Claude-in-Chrome in the session):
  both tables and their tab pairs, crew start dates with a genuinely blank
  leading cell, Previous disabled at the start and re-enabled after stepping
  forward, the dialog opening without navigation, the A-Z strip, and the
  trimmed shift form. Also disproved a worry: these pickers **do not portal**
  their menu, so the `onInteractOutside` guard is inert today, and the menu
  flips upward near the bottom rather than being clipped by the dialog's
  scroll container.
- `npm run build` clean; `npm run test` **362 passed / 0 failed** (from 349);
  eslint clean on every touched file.

## Pick up here next session

0. **Answer the open preset question** — offered and not yet answered: add
   `M A M A M · ·` as a 7-day two-shift preset? It is the *only* true
   5-on/2-off three crews can cover, so without it that roster has to be
   hand-built. Worth pairing with `A A A · M M ·`, which avoids the daily
   shift flip. → `.claude/handoff/rotation-crew-offsets-and-guardrails.md`
1. **Derive real `crew_placements` for the eight rotate seeds.** They all
   carry `[]`, so every seeded rotation reads as "set by hand" and **nothing
   on `/schedule-rotation` demonstrates the new start-day read-back**.
   Mechanical: for each crew in a seed's `day_coverage`, search the
   `(day_offset, shift_step)` pair whose `placementShifts` reproduces that
   crew's row exactly; emit `[]` for any seed whose crews don't all match.
   Also confirm the healthcare preset's fourth week against the original
   write-up (the 09-08 notes transcribed it as 8 cards for a 28-day cycle).
   → `.claude/handoff/rotation-crew-offsets-and-guardrails.md`
2. **Browser-verify the rotation coverage rework** — newest work, and the
   only item here with a written click-list. **As of 2026-09-11 this is
   reached from `/schedule-rotation` → "Assign crews", not a wizard step**
   — see the click-path in `.claude/handoff/rotation-suggestion.md`'s Open
   calls (updated for the new location). Start with the case that
   motivated it: create a rotate schedule selecting **Morning + Night**,
   preset **5-2** on the Pattern step, save it, then from
   `/schedule-rotation` → **Assign crews** → pick it → pool of **4** →
   *Suggest*: the shift rows must read `1` for Morning *and* Night on all
   seven days, **no red `0`**. Before the 09-06 rework Night was `0` on all
   seven. Then preset **2-2-3 Panama**, 2 shifts, 4 crews → one crew on
   each shift all 14 days.
   Then flip **Assign manually** on — each day card lists **one picker per
   selected shift** — and clear one: a red `0` must appear immediately
   *and* a warning naming that shift, and **Save must still succeed**
   (warn, don't block). Under-crew it (3 shifts, 2 crews) → the warning
   must read structural ("N crews would cover every shift every day"), not
   as something done wrong. Then edit the new **Start & End** section on
   that same page and Save → both the roster and the start/end settings
   must persist; re-opening "Assign crews" for that schedule must show
   "N crews assigned" and load the saved roster back into the grid. Then
   check a newly-created, not-yet-assigned schedule's wizard Summary step
   and its read-only View page both show the new "Not yet assigned…" note
   rather than a coverage panel. Then `/schedule-rotation` →
   *Plant Coverage (2-2-3)* → **Daily** tab.
   **Never-seen markup:** the coverage panel's two grids + warning list,
   the day × shift manual grid, and the whole `/schedule-rotation/assign`
   page. Also re-check the 09-03 fix — toggling Teams ⇄ Employees with the
   manual grid open must not put employee names in a team field. Full list
   in `.claude/handoff/rotation-suggestion.md`.
3. **Click through the seven screens that have never been opened in a
   browser here**: `/schedule-rotation` (**three** seeded rotations),
   `/public-holidays` and `/schedule-templates`, `/teams`, plus
   `/employees` and `/employees-list` (both reworked 2026-08-27 — flat
   form, shared `DataTable` — still unverified either way).
   *(The "clear `localStorage` keys first" advice that used to live here is
   obsolete — `src/lib/seed-store.ts`'s `SEED_VERSION` stamp re-seeds on
   its own. Bump it when editing a seed.)*
   Also click through the shift form's Assign-to tab. Note it no longer
   drives the Schedule Rotation roster — that moved onto the schedule on
   2026-08-29 — so it is sample data only; worth a look, but a bug there
   is now cosmetic rather than load-bearing.
4. **Click through the schedule form** — the `ToggleButton` conversions in
   the weekday / month-day / cycle-length / calendar grids shipped without
   a browser check (see `.claude/handoff/shift-policies.md`).
5. **Teams and the shift Assign-to employees/teams pickers were never
   documented anywhere** — built in an earlier, unrecorded session and
   only surfaced (then committed, `d808701` + `c8c333c`) on 2026-08-27
   when picking up a large batch of uncommitted work. See
   `.claude/handoff/teams-and-shift-assignment.md` for what's actually
   there.
6. Decide on the repo-wide Prettier normalization — still open, and still
   its own commit if it happens (running `prettier --write` on an
   untouched HEAD file reorders unrelated Tailwind classes).
7. Authenticate mem0 with a **correct** key (`m0-...` format, from
   https://app.mem0.ai/dashboard/api-keys) via `mem0 init --api-key <key>`,
   then run the Step 1 cross-project search before other work.
8. Fix or confirm-and-ignore the `index.html` OG/Twitter meta tag mismatch
   surfaced by graphify (`shadcn-admin.netlify.app` vs. the real GitHub
   Pages deploy target).
9. **`docs/` holds only `ROTATION_ALGORITHM.md`.** `ARCHITECTURE.md` and
   `FEATURE_MAPPING.md` were deleted in `de7eaa0` and
   `TARGET_ARCHITECTURE.md` never existed here, so there is no
   current-state map outside the rotate model. Decide whether to write one
   or to let `ROTATION_ALGORITHM.md` plus this file stand as the map.
10. `gh auth login` (interactive) if `gh` is ever needed for repo creation/PR
   work — not needed for anything done so far.
11. **Decide on the duplicate sidebar entry** for `/schedule-rotation`
    (top-level button *and* the Time Track → Schedules leaf) — kept both
    rather than deleting from a hierarchy that was deliberate and recent.
12. **`pattern-builder.tsx` week-count readout divides by a hardcoded `6`**
    while `CYCLE_LENGTH_UNIT_DAY_MULTIPLIERS.weekly` is `7` — a 7-day
    weekly cycle renders as "1 week" correct by luck. Found, not fixed.
13. **`eslint` reports 11 errors / 3 warnings repo-wide** — re-verified
    2026-09-11 after the refactor, unchanged. All `react-hooks/
    set-state-in-effect` / exhaustive-deps, across five files:
    `components/multi-select/index.tsx`,
    `schedules/components/schedule-form/{pattern-builder,schedule-form}.tsx`,
    `shift-policies/components/{policy-rules-field,time-24-input}.tsx`.
    Reconcile before treating lint as a gate.
