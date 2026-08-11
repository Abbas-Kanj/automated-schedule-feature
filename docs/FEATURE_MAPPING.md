# Feature Mapping

Living doc — maps each feature to its routes and key source files, so a session can jump straight to the right code instead of re-exploring the tree. See also [ARCHITECTURE.md](./ARCHITECTURE.md) and [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md). Update when routes/files move or a feature's status changes.

Legend: **Status** — `core` (real, actively developed domain logic) · `template` (shadcn-admin demo/boilerplate, kept as reference) · `partial` (in-progress, not fully wired).

---

## schedules — `core`

The app's real domain feature. Shift/day-based scheduling with heavy cross-field validation.

| Concern | File(s) |
|---|---|
| Routes | `src/routes/_authenticated/schedules/index.tsx` (list) · `.../new/index.tsx` (create) · `.../$scheduleId/index.tsx` (view) · `.../$scheduleId/edit/index.tsx` (edit) |
| Page composition | `src/features/schedules/index.tsx` (list page: header + table + dialogs) |
| Route-level page entry points | `src/features/schedules/pages/create/schedule-create-page.tsx` · `pages/edit/index.tsx` · `pages/view/index.tsx` (view/edit reuse `ScheduleForm` via `disabled`/`defaultValues`) |
| Validation schema (source of truth) | `src/features/schedules/data/schema.ts` — `scheduleSchema`, discriminated on `parent_type`: `daily` (`weekly`/`weekly_one`/`monthly`) and `regular` (shift/split-based, `superRefine` for cross-field rules: break time inside shift, break hours vs. duration, rotation validity, no duplicate day/month) |
| Mock/default data | `src/features/schedules/data/data.ts` · `src/features/schedules/data/schedules.ts` (`defaultSchedules`, used as localStorage fallback) |
| State | `src/features/schedules/stores/schedules-store.ts` — Zustand, persists to `localStorage` key `"schedules"`, re-validates against `scheduleSchema` on load |
| UI-only state (dialogs, selected row) | `src/features/schedules/components/schedules-provider.tsx` (`SchedulesContext`) |
| Form | `src/features/schedules/components/schedule-form/schedule-form.tsx` — multi-step `Stepper`, steps vary by `parent_type`/`type`; `getStepFields` must stay in sync with schema fields for `form.trigger(...)` per-step validation. Sub-fields: `monthly-fields.tsx`, `regular-shift-fields.tsx`, `time-range-fields.tsx`, `weekly-fields.tsx`, `weekly-one-fields.tsx`, `schedule-summary.tsx` (final review step) |
| Table | `src/features/schedules/components/schedules-table.tsx` · `schedules-columns.tsx` · `data-table-row-actions.tsx` |
| Delete/edit dialogs | `src/features/schedules/components/schedules-dialogs.tsx` |
| Shared calculation helpers | `src/features/schedules/utils.ts` — `calculateHours`, `getScheduleTotalHours`, `getScheduleSummary`, `getDaysOfMonth`, `generateId`. Single source of truth for durations — don't recompute inline in table/form. |
| Tests | colocated `*.test.ts(x)` next to the files above (e.g. `utils.test.ts`) |

---

## users — `template`

Reference implementation of the standard feature-module pattern (see CLAUDE.md).

| Concern | File(s) |
|---|---|
| Route | `src/routes/_authenticated/users/index.tsx` |
| Page | `src/features/users/index.tsx` |
| Schema/data | `src/features/users/data/schema.ts` · `data.ts` · `users.ts` |
| Components | `components/users-table.tsx`, `users-columns.tsx`, `users-provider.tsx`, `users-dialogs.tsx`, `users-action-dialog.tsx`, `users-delete-dialog.tsx`, `users-invite-dialog.tsx`, `users-multi-delete-dialog.tsx`, `users-primary-buttons.tsx`, `data-table-bulk-actions.tsx`, `data-table-row-actions.tsx` |

## tasks — `template`

| Concern | File(s) |
|---|---|
| Route | `src/routes/_authenticated/tasks/index.tsx` |
| Page | `src/features/tasks/index.tsx` |
| Schema/data | `src/features/tasks/data/schema.ts` · `data.tsx` · `tasks.ts` |
| Components | `components/tasks-table.tsx`, `tasks-columns.tsx`, `tasks-provider.tsx`, `tasks-dialogs.tsx`, `tasks-mutate-drawer.tsx`, `tasks-import-dialog.tsx`, `tasks-multi-delete-dialog.tsx`, `tasks-primary-buttons.tsx`, `data-table-bulk-actions.tsx`, `data-table-row-actions.tsx` |

## chats — `template`

| Concern | File(s) |
|---|---|
| Route | `src/routes/_authenticated/chats/index.tsx` |
| Page | `src/features/chats/index.tsx` |
| Data/types | `src/features/chats/data/chat-types.ts` |
| Components | `src/features/chats/components/new-chat.tsx` |

## apps — `template`

| Concern | File(s) |
|---|---|
| Route | `src/routes/_authenticated/apps/index.tsx` |
| Page | `src/features/apps/index.tsx` |
| Data | `src/features/apps/data/apps.tsx` |

## dashboard — `template`

| Concern | File(s) |
|---|---|
| Route | `src/routes/_authenticated/index.tsx` (app home) |
| Page | `src/features/dashboard/index.tsx` |
| Components | `components/analytics.tsx`, `analytics-chart.tsx`, `overview.tsx`, `recent-sales.tsx` |

## settings — `template`

Nested settings sections, each with its own sub-route.

| Concern | File(s) |
|---|---|
| Routes | `src/routes/_authenticated/settings/route.tsx` (layout) · `index.tsx`, `account.tsx`, `appearance.tsx`, `display.tsx`, `notifications.tsx` |
| Page shell | `src/features/settings/index.tsx` + `components/content-section.tsx`, `components/sidebar-nav.tsx` |
| Sections | `account/` (`index.tsx`, `account-form.tsx`), `appearance/` (`index.tsx`, `appearance-form.tsx`), `display/` (`index.tsx`, `display-form.tsx`), `notifications/` (`index.tsx`, `notifications-form.tsx`), `profile/` (`index.tsx`, `profile-form.tsx`) |

## auth (mock) — `core` (infra, not a "feature" page)

The default auth flow guarding everything under `_authenticated`.

| Concern | File(s) |
|---|---|
| Routes | `src/routes/(auth)/sign-in.tsx` · `sign-up.tsx` · `otp.tsx` · `forgot-password.tsx` |
| Feature pages | `src/features/auth/sign-in/sign-in-2.tsx` + `components/user-auth-form.tsx` · `sign-up/index.tsx` + `components/sign-up-form.tsx` · `otp/index.tsx` + `components/otp-form.tsx` · `forgot-password/index.tsx` + `components/forgot-password-form.tsx` · shared `auth-layout.tsx` |
| State | `src/stores/auth-store.ts` — Zustand, cookie-backed fake access token (`ACCESS_TOKEN` cookie) |
| Route guard | `src/routes/_authenticated/route.tsx` → `AuthenticatedLayout` |

## auth (Clerk) — `partial`

Parallel, not-fully-wired auth flow. See [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md) for the open question on which system should win.

| Concern | File(s) |
|---|---|
| Routes | `src/routes/clerk/route.tsx` · `clerk/(auth)/route.tsx`, `sign-in.tsx`, `sign-up.tsx` · `clerk/_authenticated/route.tsx`, `user-management.tsx` |
| Assets | `src/assets/clerk-logo.tsx`, `clerk-full-logo.tsx` |

## errors — `template`

| Concern | File(s) |
|---|---|
| Routes | `src/routes/(errors)/401.tsx`, `403.tsx`, `404.tsx`, `500.tsx`, `503.tsx` · `src/routes/_authenticated/errors/$error.tsx` |
| Components | `src/features/errors/forbidden.tsx`, `general-error.tsx`, `maintenance-error.tsx`, `not-found-error.tsx`, `unauthorized-error.tsx` |

---

## Cross-cutting (used by every feature above)

| Concern | File(s) |
|---|---|
| App shell | `src/routes/__root.tsx` → `src/components/layout/authenticated-layout.tsx`, `header.tsx`, `main.tsx`, `app-sidebar.tsx`, `top-nav.tsx`, `nav-group.tsx`, `nav-user.tsx`, `team-switcher.tsx`; sidebar nav config in `layout/data/sidebar-data.ts` |
| Data tables | `src/components/data-table/` — `column-header.tsx`, `toolbar.tsx`, `pagination.tsx`, `faceted-filter.tsx`, `bulk-actions.tsx`, `view-options.tsx`; URL-synced table state via `src/hooks/use-table-url-state.ts` |
| Dialog open/close pattern | `src/hooks/use-dialog-state.tsx` (used by every feature's `*-provider.tsx`) |
| Theming/RTL/fonts | `src/context/theme-provider.tsx`, `direction-provider.tsx`, `font-provider.tsx`, `layout-provider.tsx` |
| Shadcn/Radix primitives | `src/components/ui/*` (a subset hand-modified for RTL — check README before re-running the shadcn CLI on those) |
| Query/error plumbing | `src/main.tsx` (QueryClient, global 401/500 handling) · `src/lib/handle-server-error.ts` |
