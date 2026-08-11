# Architecture

Living doc — current-state architecture of this repo. See also [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md) (where this is headed) and [FEATURE_MAPPING.md](./FEATURE_MAPPING.md) (feature → code map). Update this file when structure, routing, or state layers change materially; don't let it drift from the code.

## Stack

- **Build/dev**: Vite 8 + `@vitejs/plugin-react`, TypeScript (`tsc -b`), path alias `@/` → `src/`.
- **Routing**: TanStack Router, file-based via `@tanstack/router-plugin`. `src/routeTree.gen.ts` is generated — never hand-edit.
- **UI**: React 19, ShadcnUI primitives over Radix UI, Tailwind v4 (`@tailwindcss/vite`), RTL support via `DirectionProvider`.
- **Forms/validation**: `react-hook-form` + `@hookform/resolvers` + `zod` (schema-first validation, discriminated unions for variant types).
- **Client state**: Zustand (`src/stores`, per-feature `stores/`). `schedules` store persists to `localStorage`.
- **Server state (scaffolded, mostly unused today)**: TanStack Query, `QueryClient` created in `src/main.tsx` with global 401/500 handling.
- **Auth**: Two coexisting flows — the default mock auth (`src/stores/auth-store.ts`, cookie-backed fake token) used by `src/routes/_authenticated/**`, and a separate, partial Clerk-based flow under `src/routes/clerk/**`. They do not share state.
- **Testing**: Vitest, run headless in real Chromium via `@vitest/browser-playwright`. Tests are colocated as `*.test.ts(x)`.
- **Template origin**: This is the [shadcn-admin](https://github.com/satnaing/shadcn-admin) template with a custom `schedules` feature added on top; most of `src/features/*` other than `schedules` is template boilerplate (users, tasks, chats, apps, dashboard, settings) kept as reference/demo pages.

## Layered view

```mermaid
flowchart TB
    subgraph entry["Entry"]
        main["main.tsx<br/>QueryClientProvider · ThemeProvider · FontProvider · DirectionProvider"]
    end

    subgraph routing["Routing (file-based, src/routes/**)"]
        root["__root.tsx"]
        authGroup["(auth) — sign-in / sign-up / otp / forgot-password"]
        authedRoute["_authenticated/route.tsx → AuthenticatedLayout"]
        authedPages["_authenticated/** — schedules, users, tasks, chats, apps, dashboard, settings"]
        clerkTree["clerk/** — parallel, partial Clerk auth flow"]
        errorsGroup["(errors) — 401/403/404/500/503"]
    end

    subgraph features["Feature modules (src/features/<name>/)"]
        pattern["data/ (zod schema + mock data) · components/ · index.tsx (Header+Main+Provider+Table/Dialogs)"]
        schedulesFeat["schedules — core domain: schema.ts, schedule-form/, utils.ts, pages/{create,edit,view}"]
    end

    subgraph state["State"]
        authStore["auth-store.ts (Zustand, cookie token, mock)"]
        schedulesStore["schedules-store.ts (Zustand, localStorage-persisted, re-validates against scheduleSchema on load)"]
        queryClient["TanStack QueryClient (wired, mostly idle — no real API calls yet)"]
    end

    subgraph ui["Shared UI (src/components/)"]
        layout["layout/ — AuthenticatedLayout, Header, Main, Sidebar, TopNav"]
        dataTable["data-table/ — column-header, toolbar, pagination, faceted-filter"]
        shadcn["ui/ — Shadcn/Radix primitives (some hand-modified for RTL)"]
    end

    main --> root
    root --> authGroup
    root --> authedRoute --> authedPages
    root --> clerkTree
    root --> errorsGroup

    authedPages --> pattern
    pattern -.-> schedulesFeat

    authedPages --> authStore
    schedulesFeat --> schedulesStore
    schedulesStore -->|persist/read| localStorage[("localStorage<br/>key: schedules")]

    main --> queryClient
    authedPages --> layout
    authedPages --> dataTable
    layout --> shadcn
    dataTable --> shadcn
```

## Request/data flow — schedules (the real domain logic)

```mermaid
sequenceDiagram
    participant U as User
    participant R as Route (_authenticated/schedules/**)
    participant P as Page (create/edit/view)
    participant F as ScheduleForm (stepper, react-hook-form)
    participant Z as zod scheduleSchema (superRefine)
    participant S as schedules-store (Zustand)
    participant LS as localStorage

    U->>R: navigate to /schedules/new|:id|:id/edit
    R->>P: render page component
    P->>S: read schedules (useSchedulesStore)
    S->>LS: (on first load) parse + validate stored JSON
    LS-->>S: valid Schedule[] or defaultSchedules (fallback)
    P->>F: render <ScheduleForm defaultValues? disabled? onSubmit>
    U->>F: fill stepper steps (per parent_type/type)
    F->>Z: form.trigger(stepFields) per step, full parse on submit
    Z-->>F: validation issues (path-scoped) or success
    F->>P: onSubmit(values)
    P->>S: addSchedule / updateSchedule
    S->>LS: persist(schedules) — JSON.stringify
    S-->>R: state update → table/re-render
```

## Key architectural facts worth remembering

- **No backend**: `schedules` (and most other features) run entirely client-side against Zustand state; `schedules` additionally persists to `localStorage`. TanStack Query is configured (401/500 handling, retry policy) but not actually driving the schedules feature yet — see [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md).
- **Schema is the source of truth for validation**: `src/features/schedules/data/schema.ts` — a `zod` discriminated union on `parent_type` (`daily` → `weekly`/`weekly_one`/`monthly`; `regular` → shift-based with `superRefine` for cross-field rules). Read it before touching form validation.
- **Two auth systems coexist**: mock (`auth-store.ts`, used everywhere under `_authenticated`) and Clerk (`routes/clerk/**`, partial/incomplete). Don't assume Clerk is wired into the main app shell.
- **`routeTree.gen.ts` is generated** — edits get overwritten; change `src/routes/**` instead.
- **Hand-modified Shadcn primitives** exist under `src/components/ui/*` for RTL support — check the README's "Customized Components" list before re-running the shadcn CLI against those files.
