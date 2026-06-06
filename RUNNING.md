# Running opencode locally

How to run the whole stack — server, web app, and desktop app — on your machine.

## Prerequisites

- **Bun 1.3.14+** (the repo pins `bun@1.3.14`; older 1.3.x mostly works but match it if you hit odd errors).
- Install dependencies once from the repo root:

  ```bash
  bun install
  ```

## The pieces

| Package | What it is | Runs from source? |
| --- | --- | --- |
| `packages/opencode` | Core logic + the headless HTTP server (the "backend"). The `opencode` CLI lives here too. | yes (hot) |
| `packages/app` | The SolidJS web UI. Talks to the server over HTTP. | yes (hot) |
| `packages/desktop` | Electron app. Bundles `packages/app` as its UI and **spawns its own copy of the server** as a sidecar process. | UI hot; server is bundled (see caveat) |

The web app finds the backend at **`http://localhost:4096`** by default (override with `VITE_OPENCODE_SERVER_HOST` / `VITE_OPENCODE_SERVER_PORT`). The standalone server's own default port is `0` (random), so **always start it with `--port 4096`** when a browser app should connect to it — the convenience scripts below do this for you.

---

## Option 1 — Desktop app (self-contained)

The desktop app is the entire stack in one command. It builds the server, launches Electron, and Electron spawns the server internally as a sidecar (on a random loopback port, with a random password). You do **not** start a separate server.

```bash
bun dev:desktop          # = bun --cwd packages/desktop dev
```

- First launch is slower: `predev` builds the server into `packages/opencode/dist/node` and copies icons.
- The **renderer (UI) hot-reloads** via electron-vite.
- **Caveat:** the sidecar server is the *built* bundle, not live source. If you change server/core code (`packages/opencode`, `packages/core`, …), rebuild it:

  ```bash
  cd packages/opencode && bun script/build-node.ts
  ```

  …then restart the desktop app. (If you're iterating heavily on the server, use Option 2 instead — it runs the server from source with hot reload.)

---

## Option 2 — Web stack (server + web app together) ⭐ best for development

One command runs the server **and** the web UI, both from source with hot reload, wired together and torn down together:

```bash
bun dev:stack            # = bun script/dev-all.ts
```

Then open **http://localhost:3000**. The server is on **http://localhost:4096**.

Flags:

```bash
bun dev:stack --port 8080        # server port (app is pointed at it automatically)
bun dev:stack --app-port 4444    # web app (vite) port
bun dev:stack --hostname 0.0.0.0 # bind the server to all interfaces
bun dev:stack --dry-run          # print the commands instead of running them
```

Prefer two terminals? That's exactly what the script automates:

```bash
# terminal 1 — server
bun dev:server                   # = opencode serve --port 4096

# terminal 2 — web app (defaults to the :4096 server)
bun dev:web                      # = vite dev server on :3000
```

---

## Option 3 — Server only

For driving the API/SDK, the TUI, or external clients without any browser UI:

```bash
bun dev:server                   # headless server on :4096
# or, raw:
bun dev serve --port 4096
```

Useful extras:

- `bun dev serve` with no `--port` picks a **random** port (printed on startup).
- Set `OPENCODE_SERVER_PASSWORD` to require Basic auth (`opencode:<password>`); unset, the local server is unsecured and prints a warning.
- Attach the TUI to a running server: `bun dev attach http://localhost:4096` (or `opencode attach …`).
- `bun dev web` opens a browser against the server, but note it proxies the **hosted** UI — it will **not** reflect local `packages/app` changes. Use Option 2 for local UI work.

---

## Ports & env vars

| Thing | Default | Override |
| --- | --- | --- |
| Server port | `4096` (via the scripts; raw `serve` default is random `0`) | `--port`, or `serve --port` |
| Web app (vite) port | `3000` | `--app-port`, or `vite --port` |
| Server host the app targets | `localhost:4096` | `VITE_OPENCODE_SERVER_HOST`, `VITE_OPENCODE_SERVER_PORT` |
| Server bind hostname | `127.0.0.1` | `--hostname`, or `serve --hostname` |
| Server auth | none (unsecured locally) | `OPENCODE_SERVER_PASSWORD` |
| Release channel | `dev` | `OPENCODE_CHANNEL` (`dev` \| `beta` \| `prod`) |

## After changing the API or SDK

If you touch the server API or SDK (e.g. `packages/opencode/src/server/server.ts`), regenerate the SDK and related files:

```bash
./script/generate.ts
```

## Gotchas

- **Web app shows nothing / "can't connect":** the server isn't on `4096`. Use `bun dev:stack`, or start the server with `--port 4096`.
- **Desktop UI changes show but server changes don't:** the desktop runs the *built* server — rebuild with `bun script/build-node.ts` (see Option 1) or switch to Option 2.
- **Tests can't run from the repo root** (guarded). Run them inside a package dir, e.g. `cd packages/opencode && bun test`.
- **Typecheck** per package: `cd packages/<pkg> && bun typecheck` (or `bun turbo typecheck` from root).
