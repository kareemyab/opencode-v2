# Local ↔ Cloud Switcher — Handoff / Session Context

Standalone context so another AI agent (or human) can resume with no prior chat history. Goal of the
session: move the cloud experience into the sidebar and let users switch **easily and symmetrically**
between the **Local** and **Cloud** environments without losing in-progress work, then fix a bug where
a cloud coding session was mis-detected as "Local".

Line numbers below are accurate as of this writing but may drift — prefer the cited **symbol names**.

---

## TL;DR / current status

- A persistent **Local | Cloud** segmented switcher lives in the shared sidebar footer
  (`SidebarProfileFooter`), visible at the bottom-left of **both** the local sidebar and the cloud shell.
- The switcher is **environment-aware** (active server + route), not path-only. A cloud session now
  correctly shows **Cloud**, and switching **resumes** the live cloud session instead of dropping it.
- Typecheck (`tsgo -b`) + lint are clean. Dev server hot-reloads cleanly (desktop, terminal pid 19214,
  cwd `/Users/nathan/orgn/opencode-v2`).

---

## Repo & environment

- Two sibling repos under `/Users/nathan/orgn`:
  - **`opencode-v2/`** — the desktop/web app monorepo (bun workspaces). All UI work here.
  - **`orgn/`** — the backend: the `agent` web app, `deno-stealth` (exposes cloud APIs at
    `api.orgn.com`), and `id.orgn.com` (auth). The app's Edge API client calls these.
- Tooling: **bun** workspaces, **Vite** (web/app), **electron-vite** + **Electron 41** (desktop),
  **SolidJS**, `@solidjs/router`, `@tanstack/solid-query`, Kobalte UI, Tailwind. Typechecker is
  `tsgo` (`@typescript/native-preview`).
- Packages:
  - `packages/app` — `@opencode-ai/app`, the SolidJS UI shared by web + desktop (where most edits are).
  - `packages/desktop` — `@opencode-ai/desktop`, the Electron shell (depends on `app`).
  - `packages/ui` — `@opencode-ai/ui`, design-system components (icons, avatar, dropdown, etc.).
- Env / flags:
  - `VITE_OPENCODE_CHANNEL` is **not set** ⇒ `newLayoutDesignsDefault = (channel !== "prod") = true`.
  - BUT the user runs with **`newLayoutDesigns === false`** (persisted setting) → the "ORGN ALPHA"
    `LegacyHome` and the footer-bearing sidebar (`SidebarProfileFooter`). **This matters** — see caveats.
  - `opencode-v2/.env` holds OLLM/OIDC dev creds; cloud/auth base URLs default to `api.orgn.com` /
    `https://id.orgn.com` (overridable via `VITE_*` envs).

---

## How to run & verify

- **Desktop app (what the user runs):** `bun run dev` in `packages/desktop` (`electron-vite dev`;
  `predev` runs `scripts/predev.ts`). It boots a sidecar (local opencode server) and an Electron window.
  HMR updates stream to that terminal. The renderer entry is `packages/desktop/src/renderer/index.tsx`.
- **Web app (UI only):** `bun run dev` in `packages/app` (`vite`).
- **Typecheck:** `bun run typecheck` in `packages/app` (and/or `packages/desktop`) → `tsgo -b`.
- **Lint:** use the editor diagnostics / project linter on changed files.
- **Manual verification of this feature:**
  1. Launch desktop → lands on `/cloud` (team switcher + projects). Footer shows **Cloud** active.
  2. Click **Local** → local home (`/`), **Local** active.
  3. Pick a cloud project → task → create/open a worktree → coding session opens. Footer must show
     **Cloud** active (not Local).
  4. Click **Local** then **Cloud** → should **resume** the same session (if sandbox healthy), not
     dump you at the browser.

---

## Mental model: two environments

- **Local** — active server is the local **sidecar** (`server.isLocal() === true`). Routes: `/` (home),
  `/{base64(dir)}/session` inside `Layout`.
- **Cloud** — either the **project browser** at `/cloud` (a dedicated full-screen shell, *not* wrapped
  in `Layout`), or a **cloud worktree session**: a normal `/{base64(workspacePath)}/session` route
  rendered in the **same `Layout`** as local sessions, but **pinned to the trial's sandbox server**
  (a remote daytona origin ⇒ `isLocal() === false`).

Key consequence (the bug's root cause): a cloud session is **not** under `/cloud`. "Which environment
am I in?" must be decided by the **active server**, not the URL path.

---

## Architecture touchpoints (file : symbol / approx line)

- `src/app.tsx`
  - `AppShellProviders` renders `<Layout>` unless `isCloud` (pathname `/cloud*`), else children directly (~L120-130).
  - Provider order, **all above the router** (so `useServer`/`useTeam`/`useGlobal` work everywhere):
    Auth → Server → Global → EdgeAPI → **Team** → Cloud → gates → Router (`AppInterface`, ~L320-373).
  - Routes (~L357-363): `/`→Home, `/cloud`→CloudRoute, `/:dir/session/:id?`→session.
- `packages/desktop/src/renderer/index.tsx` — seeds `MemoryRouter` history to `/cloud` (deterministic
  launch into cloud; no post-mount redirect/flash).
- `src/context/server.tsx`
  - `ServerConnection` types: `sidecar` (local), `http`, `ssh`. `ServerConnection.key(http)` = url (or
    `url#target`) (~L197-211). `ServerConnection.builtin(c)` = sidecar+base (~L216).
  - `server.isLocal()` = sidecar+base OR http+localhost (~L305-308). Exposes `key`, `setActive`, `list`.
- `src/utils/open-cloud.ts` — `openCloudTrial`: provision/poll sandbox → `setActiveTrial(descriptor)` →
  `connect(origin)` (`server.add` http ⇒ becomes active) → `navigate(/{base64(workspacePath)}/session)`.
- `src/context/team.tsx` — `activeTeamId`, `activeTrial()` (persisted), `setActiveTrial()` (~L62-63).
  **`activeTrial` is sticky: never cleared** — so it can't mean "currently in cloud" by itself.
- `src/pages/home.tsx` — `Home` → `LegacyHome` when `newLayoutDesigns()===false`, else `HomeDesign`.
- `src/pages/cloud.tsx` — the dedicated cloud shell (team switcher → projects → tasks → task detail +
  worktrees; open existing / `+ New worktree`; "Open a local project"; shared profile footer).

---

## The switcher (`src/pages/layout/sidebar-profile.tsx`)

Inside the shared `SidebarProfileFooter` (~L164), rendered at the bottom of both sidebars
(footer pinned via `mt-auto`; `<EnvironmentSwitcher/>` ~L206). Logic in `EnvironmentSwitcher` (~L42):

- `onCloudRoute()` = pathname `/cloud*`.
- `inCloudSession()` (~L54) = `activeTrial && (trial.serverKey === server.key, else !server.isLocal())`.
- `isCloud = onCloudRoute() || inCloudSession()` → drives the highlighted segment.
- `goLocal()` (~L70): re-activate the local sidecar (`ServerConnection.builtin`, else localhost http) +
  `navigate("/")`. If leaving a legacy cloud session (no `serverKey`), stamp the current sandbox key
  onto the trial first so it stays resumable.
- `goCloud()` (~L84): if the trial's sandbox is still in `server.list` and healthy
  (`global.servers.health[key]`), re-activate it + navigate to the session route (**resume**);
  else `navigate("/cloud")`. The trial/sandbox is never torn down.
- Clicking the already-active segment is a no-op (guarded) → can't accidentally lose a session.
- Icons `monitor` (Local) / `cloud` (Cloud) were added to `packages/ui/src/components/icon.tsx`.

---

## Trial descriptor change (enables detect + resume)

- `src/utils/edge-api-types.ts` — added `serverKey?: string` to `ActiveTrialDescriptor` (~L97-113):
  the pinned sandbox's normalized origin == its `ServerConnection` key.
- `src/utils/open-cloud.ts` — `setActiveTrial({ ...descriptor, ..., serverKey: origin })`. This is the
  **single chokepoint** for all cloud opens (only `cloud.tsx` calls `openCloudTrial`).

---

## Decision rationale (why it's built this way)

- **Switcher in the shared footer (not a top bar):** `SidebarProfileFooter` is the one component both
  the local `Layout` sidebar and the cloud shell already render, so one edit gives a symmetric,
  always-visible control. `mt-auto` pins it to the bottom even when the local sidebar is otherwise empty.
- **Detect environment from the active server, not the route:** cloud sessions render in `Layout` on a
  `/{dir}/session` route, so a path check mislabels them "Local". The active server (sandbox vs sidecar)
  is the truth. `activeTrial` alone is unreliable because it is sticky/never-cleared.
- **`serverKey` on the descriptor:** lets us (a) precisely match "this session's sandbox is active" and
  (b) resume by re-activating that exact server, instead of guessing or losing it.
- **Seed `MemoryRouter` to `/cloud` (desktop) instead of an `onMount` redirect:** the redirect was
  fragile against HMR/remounts and raced the Layout's project autoselect; seeding history is deterministic.
- **Removed the cloud shell's "Back to app" button:** redundant once the symmetric footer switcher exists.

---

## Files changed this session

- `src/pages/cloud.tsx` — dedicated cloud shell; removed redundant "Back to app".
- `src/context/cloud.tsx` — added `createTrial`.
- `src/utils/edge-api.ts` + `edge-api-types.ts` — added `trials.create` + `CreateTrialInput`; added
  `ActiveTrialDescriptor.serverKey`.
- `src/utils/open-cloud.ts` — stamp `serverKey`.
- `src/pages/layout/sidebar-profile.tsx` — `EnvironmentSwitcher` (detection + goLocal/goCloud); footer `mt-auto`.
- `src/app.tsx` — `AppShellProviders` renders Layout unless `isCloud` (removed fragile onMount redirect).
- `packages/desktop/src/renderer/index.tsx` — `MemoryRouter` seeded to `/cloud`.
- `packages/ui/src/components/icon.tsx` — added `monitor` + `cloud` icons.
- Deleted `src/components/dialog-cloud-projects.tsx` (migrated into `cloud.tsx`).

---

## Earlier session work (context)

- **Vite alias fix** (`packages/app/vite.config.ts`, ~L14-18): plain-string `find` aliases prefix-match
  in Vite's dev resolver, so `@/pages/layout` wrongly caught subpaths like `@/pages/layout/deep-links`
  → rewrote to `layout.patched.tsx/deep-links` → "Failed to resolve import". Fixed with **anchored
  regexes**: `{ find: /^@\/pages\/layout$/, ... }`, `{ find: /^@\/components\/titlebar$/, ... }`
  (mirrors `packages/desktop/electron.vite.config.ts`).
- **Permission gotcha:** `vite.config.ts` was root-owned; needed `chown` (done by the user) before it
  could be edited. Watch for root-owned files in this tree.

---

## Caveats & known gaps

- **New layout design not covered.** The switcher only shows where `SidebarProfileFooter` renders, i.e.
  `newLayoutDesigns === false`. If toggled **on**, `Layout` uses a rail-only sidebar + `HomeDesign`
  (no footer) → the switcher would need separate wiring there (e.g. `home.tsx HomeProjectColumn` and the
  rail in `sidebar-shell.tsx` / `layout.patched.tsx` BLOCK A).
- **`activeTrial` is never cleared** (sticky); team-switch gating may stay "blocked". Not addressed.
- **Legacy trials** (descriptor predating `serverKey`): detection works via the `!isLocal()` fallback;
  resume only works after leaving once (goLocal stamps the key) or re-opening from `/cloud`.
- **Resume is lightweight** (setActive + navigate); it does not re-provision a stopped sandbox — if the
  sandbox is unhealthy it falls back to the `/cloud` browser.

---

## Next steps / TODOs

1. Wire the switcher into the `newLayoutDesigns === true` paths (rail sidebar + `HomeDesign`) so it's
   present regardless of the layout flag.
2. Decide when to **clear `activeTrial`** (e.g., on trial close / sandbox terminate) and unblock team
   switching accordingly.
3. Optionally make `goCloud` re-provision a stopped sandbox (reuse `openCloudTrial`'s flow + an opening
   overlay) instead of falling back to the browser.
4. Consider persisting/restoring the **last local session** on `goLocal` (currently just navigates to
   `/` and relies on Layout autoselect).
5. Verify behavior on the **web** build (no sidecar; "local" = http localhost) — `localServerKey()`
   falls back to a localhost http connection.
