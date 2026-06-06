# Running opencode locally

Team guide to running the full stack — **server, web UI, and desktop app** — on your machine, and iterating on the UI with live reload.

- [TL;DR](#tldr)
- [Prerequisites](#prerequisites)
- [How the stack fits together](#how-the-stack-fits-together)
- [Pick your mode](#pick-your-mode)
- [Production replica (run prod locally, end-to-end)](#production-replica-run-prod-locally-end-to-end) ← a local copy of prod
- [UI development (live reload)](#ui-development-live-reload) ← the day-to-day editing loop
- [Full web stack (server + UI)](#full-web-stack-server--ui)
- [Server only](#server-only)
- [Desktop app](#desktop-app)
- [Ports & environment variables](#ports--environment-variables)
- [Troubleshooting](#troubleshooting)
- [Working as a team](#working-as-a-team)
- [Deploying (later)](#deploying-later)

---

## TL;DR

```bash
bun install            # one-time

# ⭐ the everyday command — work locally, prod-looking, on :4096, with hot reload
bun local              # frees the ports, then serves your local UI on :4096 (channel=prod)
#  → open http://localhost:4096        (edit packages/app/src/** → renders live, looks like prod)
```

`bun local` **always clears the ports first**, so it never fails with "port in use". It puts the editable **UI on `:4096`** (prod channel, HMR) and the API on `:4097` (internal). Open `:4096` and that's your local code, rendered as production.

Other entry points:

```bash
bun prod:local         # exact prod build: UI+API embedded on :4096, channel=prod, NO hot reload
bun dev:stack          # classic split: API :4096 + UI :3000 (HMR, prod channel)
OPENCODE_CHANNEL=dev bun local   # use the dev channel instead
```

| | `bun prod:local` | `bun dev:stack` |
|---|---|---|
| Open | **http://localhost:4096** | **http://localhost:3000** |
| What it is | one binary: prod UI **embedded** + API, one origin | vite UI (`:3000`) + from-source API (`:4096`) |
| Looks like prod? | ✅ yes (prod channel, built) | ✅ yes (prod channel) — except a dev-only debug overlay |
| Live reload? | ❌ no — re-run with `--rebuild` after changes | ✅ yes (instant) |
| Use it to | demo / verify prod behavior locally | actually build the UI |

> Two gotchas that cause 90% of confusion:
> 1. In **dev** mode, your edits render at **`:3000`**, *not* `:4096` — see [why](#why-4096-looks-different).
> 2. Run **one mode at a time** — both use port `:4096` for the server.

---

## Prerequisites

- **Bun `1.3.14`** — the repo pins `bun@1.3.14` in `package.json`.
  - Normal dev (`bun install`, `bun dev:stack`) tolerates nearby 1.3.x versions.
  - **The build scripts hard-require `^1.3.14`** and will throw otherwise (e.g. building the desktop server or the prod binary). If `bun --version` is older:

    ```bash
    bun upgrade            # to the latest 1.3.x
    ```
- **git**, and clone the repo. Default working branch for this team: ask your lead (we use a branch off `production`).
- Install dependencies from the repo root:

  ```bash
  bun install
  ```

---

## How the stack fits together

| Package | What it is | Runs from source with hot reload? |
| --- | --- | --- |
| `packages/opencode` | Core logic **+ the headless HTTP server** (the "backend") and the `opencode` CLI. | ✅ yes |
| `packages/app` | The **SolidJS web UI**. Talks to the server over HTTP. | ✅ yes (vite HMR) |
| `packages/ui` | Shared UI components + theme, used by `app` and `desktop`. | ✅ yes |
| `packages/desktop` | **Electron app**. Bundles `packages/app` as its UI and spawns its own copy of the server as a sidecar. | UI hot-reloads; server is a built bundle |

### Why `:4096` looks different

The server decides what to serve at `/` based on **how it was built** (`packages/opencode/src/server/shared/ui.ts`):

- **A release build** has the web UI **embedded** inside the binary → it serves that prebuilt UI.
- **Running from source** (our dev server) has **no embedded UI** → it **proxies `https://app.opencode.ai`** (the live hosted site).

So when you run the dev stack and open **`:4096`, you see the live website, not your code.** Your from-source UI is the vite server on **`:3000`**. This is expected and matches the repo's own note in `packages/app/AGENTS.md`.

---

## Pick your mode

| You want to… | Use | URL to open |
| --- | --- | --- |
| **Work locally (prod look, hot reload), `:4096`** ⭐ | `bun local` | **http://localhost:4096** |
| A local copy of prod, end-to-end (no HMR) | `bun prod:local` | **http://localhost:4096** |
| Classic split (API :4096 + UI :3000) | `bun dev:stack` | http://localhost:3000 |
| Run the API for the TUI / SDK / scripts | `bun dev:server` | `http://localhost:4096` (API) |
| Run the native desktop app | `bun dev:desktop` | (Electron window) |

> `bun local` is the everyday driver: it frees the ports first (no more "port in use"), runs everything in the **prod channel**, and serves the **editable UI on `:4096`** (API moved to `:4097` internally). `bun prod:local` and `bun dev:stack` also use `:4096` for their server — **run only one at a time.**

---

## Production replica (run prod locally, end-to-end)

**This is how you see a local copy of prod.** One command builds the opencode binary with the web UI **embedded** (channel=prod) and serves the **UI and API together on a single origin** — exactly how the released app / opencode.ai delivers it.

```bash
bun prod:local                 # build (if needed) + serve on :4096
#  → open http://localhost:4096     ← the whole app: prod UI + API, one origin
```

Flags:

```bash
bun prod:local --port 5000     # serve on a different port
bun prod:local --rebuild       # rebuild first (do this after you change code)
```

What you get:

- **One origin** serves everything: open `:4096` and the page *is* the app — the UI calls the API at the same origin (no proxy, no second server).
- **Renders as real prod:** `prod` channel → no DEV/BETA badge, production layouts, minified build.
- It runs the **same source line** opencode.ai deploys (the hosted site deploys from the `production` branch).

Caveats:

- **No hot reload** — it's a built artifact. After changing code, re-run with `--rebuild`. (To live-edit, use [UI development](#ui-development-live-reload).)
- **Not byte-identical** to live opencode.ai (different build commit/env, asset hashes, secrets) — but functionally the same app.
- First build takes a few minutes (`vite build` + binary compile); subsequent runs reuse the binary unless you pass `--rebuild`. Requires Bun `^1.3.14`.

Under the hood this is just `OPENCODE_CHANNEL=prod bun ./packages/opencode/script/build.ts --single` then running `packages/opencode/dist/opencode-<platform>/bin/opencode serve`. The `bun build:local` script runs only the build step if you want it separately.

---

## UI development (live reload)

This is the normal loop for working on the web interface.

```bash
bun dev:stack
```

This runs **both** processes from source, wired together and torn down together (Ctrl-C stops both):

- **API server** on `http://localhost:4096`
- **vite dev UI** on **`http://localhost:3000`** with hot-module reload (HMR)

Then:

1. **Open http://localhost:3000**
2. Edit files under **`packages/app/src/**`** (pages, components, contexts) or **`packages/ui/src/**`** (shared components/theme).
3. Save — the browser updates **instantly**, no rebuild, no restart.

What renders where:

| Port | What it is | Edit here for UI? |
| --- | --- | --- |
| **`:3000`** | vite dev UI — **your from-source code, with HMR** | ✅ **yes** |
| `:4096` | the API server (data the UI calls) | server code only |

### Channel: dev UI looks like prod by default

`bun dev:stack` runs the **`prod` channel** by default, so the `:3000` UI matches production — no `DEV` badge and the prod default layout (the channel drives `settings.tsx`: `newLayoutDesignsDefault = VITE_OPENCODE_CHANNEL !== "prod"`). It renders **identical to prod** except for one thing: a small floating **performance overlay (DebugBar)** in the corner. That overlay is gated on vite's dev-mode flag (`import.meta.env.DEV`), not the channel, so it stays in any hot-reload server — only a real prod build (`bun prod:local`) removes it. It's just an overlay; the actual UI matches prod.

Want the **dev channel** instead (DEV badge, new-layout designs)? Override it:

```bash
OPENCODE_CHANNEL=dev bun dev:stack    # dev channel, full stack
OPENCODE_CHANNEL=dev bun dev:web      # dev channel, UI only
bun dev:web:prod                      # prod-channel UI only (point at an existing :4096 server)
```

### Don't want a second server? (avoids port conflicts)

CORS allows **any `http://localhost:*` origin** (`packages/opencode/src/server/cors.ts`), so the UI on `:3000` can talk to *any* opencode server. If something already owns `:4096` (your own `opencode serve`, a prod binary, etc.), run **only the UI** and point it at that backend:

```bash
bun dev:web                                  # UI on :3000 → API on :4096 (default)
VITE_OPENCODE_SERVER_PORT=8080 bun dev:web   # UI on :3000 → API on :8080 (any running server)
```

`bun dev:web` is just the vite dev server — one process, no port fight.

---

## Full web stack (server + UI)

`bun dev:stack` is a small orchestrator (`script/dev-all.ts`). Flags:

```bash
bun dev:stack --port 8080        # API port (the UI is pointed at it automatically)
bun dev:stack --app-port 4444    # vite UI port
bun dev:stack --hostname 0.0.0.0 # bind the API to all interfaces (LAN access)
bun dev:stack --dry-run          # print the commands without running them
```

Prefer two terminals? That's all the orchestrator does:

```bash
# terminal 1 — API server
bun dev:server                   # opencode serve --port 4096

# terminal 2 — web UI
bun dev:web                      # vite dev server on :3000 (targets :4096)
```

---

## Server only

For the TUI, SDK, scripts, or external API clients — no browser UI:

```bash
bun dev:server                   # headless API on :4096
# raw equivalent:
bun dev serve --port 4096
```

Notes:

- `bun dev serve` **without `--port` picks a random port** (printed on startup). The web UI defaults to `:4096`, so pin it.
- Set `OPENCODE_SERVER_PASSWORD` to require Basic auth (`opencode:<password>`). Unset → unsecured locally (prints a warning).
- Attach the TUI to a running server: `bun dev attach http://localhost:4096`.

---

## Desktop app

The desktop app renders the **same `packages/app` UI** inside an Electron shell. It's the whole stack in one command — it builds the server and spawns it internally as a sidecar (random loopback port + password). **You do not start a separate server**, and it does **not** use `:4096`/`:4097`, so it can run alongside `bun local`.

```bash
bun dev:desktop                       # prod channel by default (matches bun local)
OPENCODE_CHANNEL=dev bun dev:desktop  # dev channel instead
```

- **Prod channel by default** — same as `bun local`, so the desktop UI matches production (no DEV badge, prod layout). (In unpackaged dev the OS-level app name stays "OpenCode Dev"; that label is separate from the rendered channel.)
- First launch is slower: it builds the server into `packages/opencode/dist/node` (requires Bun `^1.3.14`).
- The **renderer (UI) hot-reloads** via electron-vite — edit `packages/app/src/**` and the desktop window updates live, same as the browser.
- **Caveat:** the sidecar server is a *built bundle*, not live source. If you change server/core code, rebuild it and restart the app:

  ```bash
  cd packages/opencode && bun script/build-node.ts
  ```

  For heavy server iteration, prefer `bun local` (server runs from source).

---

## Ports & environment variables

| Thing | Default | Override |
| --- | --- | --- |
| API server port | `4096` (via scripts; raw `serve` default is random `0`) | `--port` / `serve --port` |
| Web UI (vite) port | `3000` | `--app-port` / `vite --port` |
| Which server the UI targets | `localhost:4096` | `VITE_OPENCODE_SERVER_HOST`, `VITE_OPENCODE_SERVER_PORT` |
| API bind hostname | `127.0.0.1` | `--hostname` / `serve --hostname` |
| API auth | none locally | `OPENCODE_SERVER_PASSWORD` |
| Extra CORS origins | `localhost:*`, `127.0.0.1:*`, `*.opencode.ai` allowed | `serve --cors <origin>` |
| Release channel (badge/layout) | falls back to branch name → `dev` | `OPENCODE_CHANNEL` = `dev` \| `beta` \| `prod` |

---

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| `vite: command not found` | Deps not installed. Run `bun install`. |
| `error: preload not found "@opentui/solid/preload"` | Same — `bun install`. |
| `ServeError … Is port 4096 in use?` | Another opencode server owns `:4096`. Either free it (`lsof -nP -iTCP:4096 -sTCP:LISTEN` then `kill <pid>`), run on another port (`bun dev:stack --port 4097`), or skip the second server with `bun dev:web` pointed at the existing one. |
| Build throws `requires bun@^1.3.14` | Your Bun is too old. `bun upgrade`. |
| UI on `:3000` is blank / "can't connect" | No API server reachable. Start one (`bun dev:server`) or use `bun dev:stack`. |
| Opened `:4096` and it doesn't show my UI changes | Expected — from-source `:4096` proxies the live site. Use **`:3000`**. See [Why `:4096` looks different](#why-4096-looks-different). |
| Desktop UI updates but server changes don't | Desktop runs a built server. Rebuild: `cd packages/opencode && bun script/build-node.ts`, then restart. |
| Changed the API/SDK | Regenerate: `./script/generate.ts`. |
| Tests fail with `do-not-run-tests-from-root` | Run from a package dir: `cd packages/opencode && bun test`. |

---

## Working as a team

- **Branching/commits:** conventional commits (`type(scope): summary`, types: `feat`/`fix`/`docs`/`chore`/`refactor`/`test`). See `AGENTS.md` / `CONTRIBUTING.md`.
- **Typecheck:** `bun turbo typecheck` (root) or `cd packages/<pkg> && bun typecheck`.
- **Lint:** `bun lint` (oxlint).
- **After API/SDK changes:** run `./script/generate.ts` so the generated SDK stays in sync.
- **Shared UI:** put reusable components/theme in `packages/ui`; app-specific screens in `packages/app`.

---

## Deploying (later)

The web app is deployed via SST. `opencode.ai` is built from the `production` branch (`.github/workflows/deploy.yml` runs `bun sst deploy --stage=production`), and `infra/stage.ts` maps the stage to a domain. To stand up your own environment:

```bash
bun sst deploy --stage=<your-stage>
```

The `packages/app` you edit locally is exactly what gets built and served in prod, so local UI work is 1:1 with what your users will see. (Talk to your lead before deploying — prod stages are protected.)
