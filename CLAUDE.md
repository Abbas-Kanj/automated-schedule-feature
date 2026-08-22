# automated-schedule-feature

## What this is

Three real feature modules — **`schedules`** (shift/day-based scheduling,
heavy cross-field validation), **`shifts`** (reusable shift definitions),
and **`shift-policies`** (attendance rules attached to shifts) — built on
top of the [shadcn-admin](https://github.com/satnaing/shadcn-admin) admin
dashboard template. The template's other feature modules (users, tasks,
chats, apps, dashboard, settings) are kept as reference/demo boilerplate;
those three are the real domain logic. GitHub Pages deploy configured via
`.github/workflows/deploy-pages.yml`. See `docs/ARCHITECTURE.md` and
`docs/FEATURE_MAPPING.md` for the full current-state map — this file doesn't
duplicate them, just points at them and adds session-level state.

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
- **Two coexisting auth flows**: mock (`auth-store.ts`, used under
  `_authenticated/**`) and a separate partial Clerk flow (`routes/clerk/**`).
  Don't assume Clerk is wired into the main app shell.
- **Vitest in real Chromium** via `@vitest/browser-playwright`, tests
  colocated as `*.test.ts(x)`.
- **`bridge/`** — a file-based bridge for delegating tasks from Claude Code
  to local OpenCode agents (cheaper/alternate models) and picking up results
  async. Full protocol lives in the `opencode-agents-bridge` skill — confirmed
  installed and loadable on this machine as of 2026-08-16 (see gotcha below).

## Known environment gotchas

- **RESOLVED 2026-08-16: `opencode-agents-bridge` skill is installed.** The
  2026-08-11 note below said it wasn't found under `~/.claude/skills/` or the
  D:\skills backup; it's since confirmed present at
  `~/.claude/skills/opencode-agents-bridge` (file-dated 2026-08-11 4:07 PM —
  it landed later the same session, just after that note was written) and
  loads normally. `bridge/` scripts should work as documented.
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

- **The `handoff-before-clear` skill describes machinery that is NOT
  installed on this machine** (verified 2026-08-21). The skill documents a
  global `/handoff` command plus a `SessionStart`/`matcher: "clear"`
  staleness-warning hook. In reality: `~\.claude\commands\` **does not
  exist at all** (so there is no `/handoff` command), there is no
  `~\.claude\hooks\handoff-stale-on-clear.py`, and the `SessionStart`
  hook actually wired in `~\.claude\settings.json` is
  `bridge-session-start.py` with **no `matcher`**. Net effect: **nothing
  warns you** if you `/clear` with a stale handoff file — do the handoff
  update manually before clearing. Either install the two missing pieces or
  correct the skill; don't trust its "Mechanism" section as-is.

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
`lib/id.ts#generateId`, `lib/time.ts#toMinutes`. And use the shadcn
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

## Pick up here next session

1. **Click through the three newly-pulled screens** (`/employees`,
   `/employees-list`, `/official-holidays`) — ported, typechecked and
   linted, but never opened in a browser here.
2. **Click through the schedule form** — the `ToggleButton` conversions in
   the weekday / month-day / cycle-length / calendar grids shipped without
   a browser check (see `.claude/handoff/shift-policies.md`).
3. Decide on the repo-wide Prettier normalization — still open, and still
   its own commit if it happens (running `prettier --write` on an
   untouched HEAD file reorders unrelated Tailwind classes).
4. Authenticate mem0 with a **correct** key (`m0-...` format, from
   https://app.mem0.ai/dashboard/api-keys) via `mem0 init --api-key <key>`,
   then run the Step 1 cross-project search before other work.
5. Fix or confirm-and-ignore the `index.html` OG/Twitter meta tag mismatch
   surfaced by graphify (`shadcn-admin.netlify.app` vs. the real GitHub
   Pages deploy target).
6. `docs/TARGET_ARCHITECTURE.md` is a dangling reference — recreate it or
   remove the references to it in `ARCHITECTURE.md`/`FEATURE_MAPPING.md`.
   `docs/ARCHITECTURE.md` / `FEATURE_MAPPING.md` also predate
   `shift-policies` and the shared `DataTable`.
7. `gh auth login` (interactive) if `gh` is ever needed for repo creation/PR
   work — not needed for anything done so far.
