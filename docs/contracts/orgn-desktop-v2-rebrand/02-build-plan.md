# ORGN Desktop v2 Rebrand Build Plan

## Status

- Phase: BUILD_PLAN
- Created: 2026-06-06
- Based On: `docs/contracts/orgn-desktop-v2-rebrand/01-recon.md`

## Handoff Summary (read this first)

**One sentence:** We are turning the `opencode-v2` Electron desktop app (`packages/desktop` → `@opencode-ai/app` → `@opencode-ai/ui` → sidecar in `packages/opencode`) into orgn’s branded desktop product by replacing every **user-visible** OpenCode identity marker — name, logo, colors, copy, OS registration, and update metadata — while **keeping the runtime plumbing compatible** (`~/.config/opencode`, `.opencode/`, SDK/OpenAPI shapes) so the existing orgn web stack does not break.

**The apartment analogy (from recon):** The agent engine is the plumbing. The rebrand is the mailbox, lease, welcome mat, and paint. We are not rewiring the pipes in this effort unless a branding change forces it (e.g. deep link scheme, app bundle ID for code signing).

### Who owns what

| Workstream | Owner (suggested) | What they deliver |
|---|---|---|
| Product naming & external copy | Product (Kareem) | Locked name: **orgn** in user-facing UI; **CDE** acceptable as subtitle/tooltip only if needed for v1 continuity |
| Visual design (theme + logo) | Design / FE | `orgn.json` theme spec + icon set approved against v1 launchpad + web tokens |
| Desktop implementation | Engineering | Phases 1–3 in `opencode-v2` |
| Identity / OAuth | Platform | Register new desktop bundle ID + `orgn://` redirect URIs with id-orgn |
| Release infra | Infra / Eng | orgn-controlled update URL, codesign, notarization (replace GitHub `anomalyco/opencode`) |
| QA sign-off | Eng + Product | Manual QA checklist below on macOS + one secondary OS |
| Out of scope enforcement | Tech lead | Block PRs that rename `@opencode-ai/*`, change OpenAPI, or touch `packages/console/*` without explicit approval |

### What we are **not** building (common misreadings)

- Renaming all `@opencode-ai/*` workspace packages (fork merge cost; not user-visible)
- Rebranding `packages/console/*`, `packages/web`, `packages/stats/*`, or SST infra
- Rewriting agent/session logic in `packages/opencode`
- id-orgn login, oLLM routing, or attestation UI (follow-up contracts — only stub hooks if needed)
- Migrating config directories from `~/.config/opencode` → `~/.config/orgn` in the first shipping slice
- Porting orgn web’s Remix/shadcn stack to SolidJS

### Blocking dependencies — proven vs unknown

| Item | Status | Resolution |
|---|---|---|
| Logo SVG source | **Proven** — `vscode-cde/.../orgnLogoWordmark.svg`, `orgnLogoMark.svg` | Copy into `packages/ui` assets |
| Token hex values | **Proven** — `orgn/apps/agent/styles/security-tokens.css` | Map to desktop theme JSON |
| Default runtime paths | **Proven** — `packages/core/src/global.ts` uses `app = "opencode"` | **Compat mode** for v1: keep paths, rebrand skin only |
| Desktop icon binaries | **Unknown** — `packages/desktop/resources/icons/*` referenced in builder but mostly absent from checkout | Phase 0: generate from orgn mark or export from v1 branding scripts |
| Update server URL | **Unknown** — prod channel still points at GitHub `anomalyco/opencode` | Infra must provision before beta channel ships |
| Shipping name orgn vs CDE | **Unknown in Linear** — **Proposed default:** user-facing **orgn**, window subtitle optional “Confidential Development Environment” | Product sign-off in Phase 0 |
| Deep link scheme | **Unknown** — **Proposed default:** `orgn://` with transitional `opencode://` handler | Identity team registers `orgn://` |
| Font on desktop | **Unknown** — web ships Berkeley Mono; design docs mention Space Mono/RM Neue | **Proposed default:** Berkeley Mono if licensable in Electron; else system monospace fallback for slice 1 |

---

## Implementation Principle

Introduce a **single brand constants module** early, then replace scattered strings and assets to reference it. Ship a **thin vertical slice** first (English UI, default dark theme, logo, Electron metadata) and validate visually before sweeping 15+ locales. Keep **runtime compatibility** by not renaming XDG paths or `.opencode/` in the first release; users and orgn web integrations continue reading the same config locations while seeing orgn everywhere that matters. Treat distribution (app ID, signing, update feed) as a **separate hard gate** before any public beta — wrong app ID invalidates auto-update trust chains.

---

## Scope

### In This PR (full rebrand program — multiple PRs, one epic)

**Packages:**

- `packages/desktop` — Electron shell, builder, updater strings, deep links, dock/window metadata
- `packages/app` — SolidJS UI copy, deep links, WSL UX strings, desktop menu, settings/about
- `packages/ui` — Logo, favicon, theme system, UI i18n, storybook labels
- `packages/opencode` — **User-facing CLI/TUI/error strings only** (not agent logic)
- `packages/core` — **Optional:** `BRAND` constants export only; **not** `Global.Path` slug change in v1

**New shared artifact:**

- `packages/ui/src/brand/` (or `packages/core/src/brand.ts`) — product name, URLs, protocol scheme, storage key prefixes

### Out Of Scope

- `@opencode-ai/*` → `@orgn/*` package renames
- `packages/sdk/openapi.json` and generated SDK type renames
- `Global.Path` / `.opencode/` directory migration
- `packages/console/*`, `packages/web`, `packages/stats/*`, `infra/*`, `sst.config.ts`
- id-orgn auth UI, oLLM gateway wiring, attestation surfaces
- Removing OpenCode Zen / provider product names where they refer to **third-party SKUs** (rename copy to orgn-oLLM or hide until orgn providers ship)

### Follow-Up Candidates (separate tickets)

| Ticket | Why separate |
|---|---|
| Config path migration (`opencode` → `orgn` on disk) | High breakage risk; needs migration tooling |
| id-orgn launch gate in Solid | OAuth redirect + session UX is its own vertical slice |
| oLLM default provider routing | Product + backend coupling |
| Package scope rename `@orgn/*` | Fork strategy decision |
| Console/marketing site removal or rebrand | Not desktop blocker |
| TEE attestation status in desktop chrome | Product priority |
| CLI binary rename `lildax` → `orgn` with shim | Terminal DX + install scripts |

---

## Phase 0: Safety Setup

### Goal

Lock decisions, establish a brand source-of-truth, and create guardrails so implementation does not drift into high-risk refactors (config paths, package renames, API changes).

### Steps

1. **Decision workshop (30–60 min)** — record outcomes in `docs/contracts/orgn-desktop-v2-rebrand/DECISIONS.md`:
   - User-facing product name: **orgn** (proposed default)
   - Electron `appId` pattern: `com.orgn.desktop` / `com.orgn.desktop.dev` / `com.orgn.desktop.beta` (proposed — replace `ai.opencode.desktop*`)
   - Protocol scheme: **`orgn://`** primary; keep **`opencode://`** as read-only alias for one release (proposed)
   - Config strategy: **compat mode** — keep `~/.config/opencode`, `.opencode/`, `opencode.json` filenames
   - Default theme id: **`orgn`**
   - Typography: Berkeley Mono vs fallback (design sign-off)

2. **Create brand module** (new files):
   - `packages/ui/src/brand/constants.ts` — exports:
     - `PRODUCT_NAME`, `PRODUCT_NAME_DESKTOP`, `PRODUCT_TAGLINE`
     - `COMPANY_URL`, `DOCS_URL`, `SUPPORT_URL`, `ID_URL`
     - `DEEP_LINK_SCHEME`, `LEGACY_DEEP_LINK_SCHEME`
     - `STORAGE_PREFIX` (new keys) + `LEGACY_STORAGE_PREFIX` (read fallback)
     - `THEME_ID_DEFAULT`, `THEME_STYLE_ID`
   - Re-export from `packages/ui/src/brand/index.ts` for app/desktop consumption

3. **Asset inventory & import**
   - Copy from v1 desktop:
     - `vscode-cde/.../orgnLogoWordmark.svg` → `packages/ui/src/assets/orgn-logo-wordmark.svg`
     - `vscode-cde/.../orgnLogoMark.svg` → `packages/ui/src/assets/orgn-logo-mark.svg`
   - Generate Electron icons (`.icns`, `.ico`, PNG set) into `packages/desktop/resources/icons/` using orgn mark — adapt `vscode-cde/scripts/orgn-branding/` if needed
   - Replace favicon set referenced by `packages/ui/src/components/favicon.tsx` (`/favicon-96x96-v3.png`, etc.) in `packages/app/public/` or desktop static assets

4. **Baseline grep audit** (store output in `docs/contracts/orgn-desktop-v2-rebrand/audit-baseline.txt`):
   ```bash
   rg -n 'OpenCode|opencode\.ai|opencode://|ai\.opencode\.desktop' \
     packages/desktop packages/app packages/ui \
     --glob '!node_modules' --glob '!.artifacts'
   ```

5. **Branch & PR strategy**
   - Epic branch: `feat/orgn-desktop-rebrand`
   - PR1: Phase 1 vertical slice
   - PR2: Phase 2 locale + persistence
   - PR3: Phase 3 distribution + UX polish
   - PR4: Phase 4 CI gates + tests
   - PR5: Phase 5 docs + cleanup

### Validation

- [ ] `DECISIONS.md` exists with explicit defaults for every recon unknown
- [ ] Brand module imports without circular deps from `packages/desktop`
- [ ] Icon files present at paths referenced by `electron-builder.config.ts`
- [ ] Baseline audit file committed for diff comparison

### Stop Conditions

- **Stop** if product cannot choose orgn vs CDE within 48h — implement Phase 1 with `PRODUCT_NAME` constant only (no hardcoded strings) and pause before locale sweep
- **Stop** if orgn logo assets are unavailable — do not ship placeholder OpenCode logo; use text wordmark “orgn” temporarily
- **Stop** if legal blocks Berkeley Mono in desktop — document fallback font in `DECISIONS.md` before theme work

---

## Phase 1: Minimal Vertical Slice

### Goal

A developer running `bun run dev:desktop` sees **orgn** (not OpenCode) in the window title, splash, default colors, and core English strings — without breaking sidecar boot or SDK calls.

### Expected File Changes

| File | Change |
|---|---|
| `packages/ui/src/components/logo.tsx` | Replace OpenCode letterform SVG with orgn mark/wordmark components |
| `packages/ui/src/components/logo.css` | Adjust sizing; sharp corners per brand |
| `packages/ui/src/components/favicon.tsx` | `apple-mobile-web-app-title` → orgn; favicon paths → orgn assets |
| `packages/ui/src/theme/themes/orgn.json` | **New** — dark-first monochrome + Spectral Teal / Electric Violet signals |
| `packages/ui/src/theme/default-themes.ts` | Export `orgnTheme` |
| `packages/ui/src/theme/context.tsx` | Default theme `orgn`; `STORAGE_KEYS` use brand module; migrate read from legacy keys |
| `packages/ui/src/theme/desktop-theme.schema.json` | Optional: `$schema` comment pointing to orgn-hosted schema (follow-up) |
| `packages/desktop/electron-builder.config.ts` | `productName`, `appId`, `artifactName`, `protocols` → orgn |
| `packages/desktop/src/main/index.ts` | `APP_NAMES`, `APP_IDS` → orgn |
| `packages/desktop/src/main/constants.ts` | Settings store keys: write new prefix, document legacy |
| `packages/desktop/src/renderer/index.html` | `<title>orgn</title>` |
| `packages/desktop/src/renderer/index.tsx` | Favicon URL, deep link event name via brand constants |
| `packages/desktop/src/renderer/i18n/en.ts` | Updater + CLI strings → orgn |
| `packages/app/src/i18n/en.ts` | High-traffic keys: `app.name.desktop`, settings descriptions, toast.update, error.page.report |
| `packages/app/src/pages/layout/deep-links.ts` | Parse `orgn://`; alias `opencode://` |
| `packages/app/src/components/titlebar.tsx` | App title if hardcoded |
| `packages/ui/src/brand/*` | New module from Phase 0 |

### Steps

1. **Logo replacement**
   - Implement `OrgnMark`, `OrgnWordmark`, `OrgnSplash` in `logo.tsx` (keep exported names `Mark`, `Splash`, `Logo` as aliases to minimize call-site churn, or rename with re-exports)
   - Update `logo.stories.tsx` descriptions

2. **Theme: `orgn.json`**
   - Derive palette from proven tokens:
     - Surfaces: `#000000`, `#141414`, borders `#1F1F1F` (v1 `orgn_cde_black.json`)
     - Signal: primary `#2FFFD7`, accent/interactive `#7A5CFF`, info `#4FA8FF`, error `#ff3333`
   - Map `v2Overrides` grey ramp to monochrome (reference `oc-2.json` structure — proven working)
   - Set `theme-color` meta in `context.tsx` applyThemeCss for dark: `#000000`
   - Change default fallback: `normalize(...) ?? "orgn"` instead of `"oc-2"`
   - Hide `opencode` theme from default picker UI (keep file for upstream merge)

3. **Electron metadata (dev channel first)**
   - `APP_NAMES`: `{ dev: "orgn Dev", beta: "orgn Beta", prod: "orgn" }`
   - `appId`: `com.orgn.desktop.dev` (dev), etc.
   - `artifactName`: `orgn-desktop-${os}-${arch}.${ext}`
   - `protocols`: `{ name: "orgn", schemes: ["orgn"] }` — add second scheme `opencode` only if DECISIONS.md requires transition

4. **English i18n — priority keys (desktop + app)**
   - Desktop renderer `en.ts`: all `desktop.updater.*`, `desktop.cli.*`
   - App `en.ts` minimum set:
     - `app.name.desktop`
     - `settings.general.row.*.description` (4 keys)
     - `settings.updates.*`
     - `toast.update.description`
     - `error.page.report.prefix`
     - `sidebar.gettingStarted.line1`
   - Use `{{productName}}` interpolation where strings repeat — add helper in brand module

5. **Deep links (dual-read)**
   - `parseUrl`: accept `orgn://` and legacy `opencode://`
   - Rename event: `orgn:deep-link` (desktop renderer + preload IPC)
   - Window global: `__ORGN__` with legacy read from `__OPENCODE__` in `drainPendingDeepLinks`

6. **Dev smoke**
   - Run desktop dev; confirm sidecar still starts
   - Confirm theme applies on cold start (no flash of oc-2)

### Validation

- [ ] `bun run dev:desktop` — window title and splash show orgn branding
- [ ] Default UI theme is dark monochrome with teal/violet accents (visual compare to v1 launchpad screenshot)
- [ ] `rg 'OpenCode' packages/desktop/src/renderer/i18n/en.ts packages/app/src/i18n/en.ts` returns zero matches in user strings (provider SKU strings may remain — document exceptions)
- [ ] Deep link `orgn://open-project?directory=/tmp` opens project (manual)
- [ ] Sidecar health: session can be created; `/config/providers` responds (SDK unchanged)
- [ ] `bun run typecheck` passes for `desktop`, `app`, `ui` packages

### Stop Conditions

- **Stop** if theme JSON fails schema validation — fix schema or overrides before continuing
- **Stop** if sidecar fails to boot after metadata-only changes — revert Electron protocol changes first; binary incompatibility is unlikely but blocking
- **Stop** if logo replacement breaks layout in splash (fix before locale sweep)

---

## Phase 2: Correctness Expansion

### Goal

Complete the rebrand across **all locales**, **persistence keys**, **menus**, **WSL flows**, and **residual UI surfaces** so no user-facing English or i18n key exposes OpenCode in the desktop path.

### Expected File Changes

| Area | Files |
|---|---|
| Desktop i18n | `packages/desktop/src/renderer/i18n/*.ts` (15 locales) |
| App i18n | `packages/app/src/i18n/*.ts` (18 locales) |
| UI i18n | `packages/ui/src/i18n/*.ts` (16 locales) |
| WSL | `packages/app/src/wsl/settings-model.ts`, `dialog-add-server.tsx`, `settings.tsx`, `packages/desktop/src/main/wsl/*.ts` |
| Desktop menu | `packages/app/src/desktop-menu.ts`, `packages/app/src/components/windows-app-menu.tsx` |
| Storage migration | `packages/ui/src/theme/context.tsx`, `packages/desktop/src/main/constants.ts`, `packages/app/src/context/settings.tsx`, `packages/app/src/utils/persist.ts` |
| Theme names map | `packages/ui/src/theme/context.tsx` `names` record — rename display entry `opencode: "OpenCode"` → remove or alias |
| Storybook | `packages/storybook/.storybook/preview.tsx`, `manager.ts` |
| Provider dialog copy | `packages/app/src/i18n/*` — rewrite OpenCode Zen strings to orgn/oLLM framing **or** hide provider until orgn backend ready |
| CLI user strings | `packages/opencode/src/cli/error.ts`, `cmd/uninstall.ts`, selected TUI strings |
| Tests | `packages/app/src/theme-preload.test.ts`, `packages/app/src/wsl/settings-model.test.ts` |

### Steps

1. **Locale sweep automation**
   - Script or codemod: replace `OpenCode` → `{{productName}}` or literal `orgn` in i18n dicts
   - **Do not** blindly replace inside provider IDs (`opencode`, `opencodeZen`) — use allowlist file `i18n-replace-allowlist.txt`
   - Manual review for CJK/RTL locales after mechanical pass

2. **Storage key migration (read-fallback, write-new)**
   - On read: try `orgn-theme-id`, fall back to `opencode-theme-id`
   - On write: use `orgn-*` keys only
   - Same pattern for:
     - `opencode.settings` → `orgn.settings` (`desktop/src/main/constants.ts`)
     - `opencode.global.dat` → `orgn.global.dat` (renderer + preload)
   - One-time migration on app boot in `packages/desktop/src/main/migrate.ts` (extend existing migrate module)

3. **WSL copy & probe labels**
   - User-visible: “Install orgn”, “Update orgn” in `settings-model.ts`
   - Internal probe kinds can stay `probe-opencode` (not user-visible) — document in code comment

4. **Theme picker UX**
   - Default cycle order: `orgn` first
   - Demote or remove from picker: `opencode`, `oc-2` as branded defaults (keep files)
   - Update `packages/app/src/theme-preload.test.ts` expectations: `oc-2` → `orgn`

5. **External URL purge (desktop path)**
   - Replace `https://opencode.ai/...` in:
     - `packages/desktop/src/renderer/index.tsx` (notification icon)
     - `packages/ui/src/components/favicon.tsx` / public assets
     - App provider connect strings → `orgn.com` / `id.orgn.com` / docs URL from brand constants
   - Grep gate:
     ```bash
     rg 'opencode\.ai' packages/desktop packages/app packages/ui
     ```

6. **Sidecar auth display strings**
   - `packages/opencode/src/server/auth.ts` — default username can remain `opencode` internally (compat) but **error messages** shown in desktop should say orgn server

7. **OpenCode Zen / provider branding decision**
   - If orgn oLLM not ready: hide “OpenCode Zen” provider tile; replace free-models banner with orgn copy
   - If ready: rename to orgn gateway strings only

### Validation

- [ ] `rg 'OpenCode' packages/desktop packages/app packages/ui --glob '*.ts' --glob '!*.test.ts'` — zero matches except documented allowlist (provider IDs, legacy scheme handlers, comments)
- [ ] `rg 'opencode\.ai' packages/desktop packages/app packages/ui` — zero matches
- [ ] All unit tests in `packages/app` and `packages/ui` pass
- [ ] Storage migration test: seed legacy keys → relaunch → reads succeed, new keys written
- [ ] WSL settings model tests updated and green

### Stop Conditions

- **Stop** if locale sweep breaks i18n key parity — run i18n key diff script before merge
- **Stop** if provider dialog changes block login flows — revert provider copy, ship generic orgn placeholder
- **Stop** if storage migration corrupts settings — disable write path, read-only fallback

---

## Phase 3: UX and Failure Handling

### Goal

Polish the experience at the edges users hit when things go wrong or when they install/update: updater dialogs, about/release notes, error pages, CLI install messages, and OS-level presentation (dock, About panel, installer name).

### Expected File Changes

| File | Change |
|---|---|
| `packages/desktop/src/main/updater.ts` | Dialog strings via i18n; verify feed URL from env (not hardcoded GitHub) |
| `packages/desktop/electron-builder.config.ts` | `publish` → orgn update endpoint (beta/prod channels) |
| `packages/desktop/package.json` | `homepage`, `author` → orgn |
| `packages/desktop/scripts/copy-metainfo.ts` | Linux `.desktop` file `Name=`, `Comment=` |
| `packages/desktop/src/main/windows.ts` | `setDockIcon`, background color `#000000` |
| `packages/app/src/components/dialog-release-notes.tsx` | orgn copy |
| `packages/app/src/pages/error.tsx` | Report link → orgn support |
| `packages/opencode/src/cli/cmd/uninstall.ts` | “Uninstall orgn” intro (user-visible) |
| `packages/opencode/src/cli/error.ts` | User-facing hints reference orgn config, not opencode team |
| `packages/ui/src/context/marked.tsx` | Any OpenCode link text in markdown renderers |
| `packages/app/e2e/**` | Update fixtures referencing OpenCode window title |

### Steps

1. **Updater pipeline (requires infra)**
   - Configure `electron-updater` `publish` URL to orgn bucket (mirror v1 `vscode-cde/product.json` `updateUrl` pattern)
   - Dev channel: disable updater (`UPDATER_ENABLED` already false for dev — proven)
   - Beta/prod: codesign with orgn certificates; **new appId must match signing identity**
   - Dialog copy already in i18n from Phase 2 — verify native OS dialogs show orgn

2. **About / metadata surfaces**
   - Ensure `app.getName()` returns orgn in About panel (Electron uses `productName`)
   - Windows App User Model ID — update if required for taskbar pinning (Windows-specific)

3. **Failure UX audit**
   - Trigger error page (kill sidecar) — confirm no “OpenCode team” string
   - MCP error chain messages (`error.chain.mcpFailed`) — orgn voice, accurate capability claims
   - Update toast when no update available — orgn wording

4. **Linux packaging metadata**
   - `.desktop` entry: `Name=orgn`, `Comment=Confidential agentic development environment`
   - RPM/DEB package names: `orgn-desktop` (replace `opencode` rpm packageName)

5. **E2E alignment**
   - Update Playwright smoke tests if they assert window title or screenshots

### Validation

- [ ] Packaged build (macOS `.dmg` or Linux `AppImage`) shows orgn in Finder/installer
- [ ] About dialog shows orgn version string
- [ ] Updater check against **staging** feed succeeds (infra) or is disabled with explicit config
- [ ] Error page renders orgn support link
- [ ] E2e smoke passes: `bun --cwd packages/app test:e2e:local` (or CI subset)

### Stop Conditions

- **Stop** if codesign/notarization fails on new appId — do not ship prod until infra resolves
- **Stop** if updater points at wrong feed (verify `files[].url` in log output from `updater.ts`)
- **Stop** if e2e screenshot tests block merge — update baselines in dedicated commit with visual review

---

## Phase 4: Security and Regression Tests

### Goal

Prevent brand regression and secure user-controlled inputs introduced by scheme changes — without claiming SOC2 completeness.

### Expected File Changes

| File | Change |
|---|---|
| `packages/app/src/pages/layout/deep-links.ts` | Strict URL validation; reject malformed hosts |
| `packages/app/src/pages/layout/deep-links.test.ts` | **New** — orgn + legacy scheme cases |
| `packages/desktop/src/main/index.ts` | Protocol handler registration tests |
| `.github/workflows/*` or `scripts/check-branding.sh` | **New** CI grep gate |
| `packages/app/src/theme-preload.test.ts` | Already updated in Phase 2 |
| `packages/opencode/test/server/sdk-v1-smoke.test.ts` | Run unchanged — API compat proof |
| `docs/contracts/.../audit-final.txt` | Post-implementation grep output |

### Steps

1. **Deep link security**
   - Allowlist hosts: `open-project`, `new-session` only
   - Reject `orgn://` URLs with embedded credentials or non-file paths
   - Legacy `opencode://` same validation path
   - Unit tests for injection attempts (`orgn://evil?directory=...`)

2. **CI branding gate** — add `scripts/check-orgn-branding.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   rg -n 'OpenCode|opencode\.ai' packages/desktop packages/app packages/ui \
     --glob '!node_modules' --glob '!*.md' \
     --glob '!**/i18n-replace-allowlist.txt'
   ```
   Allowlisted paths: provider ID enums, legacy storage fallback code, OpenAPI-generated files (not in these packages)

3. **SDK smoke (regression)**
   - Run existing server tests:
     ```bash
     bun --cwd packages/opencode test/server/httpapi-sdk.test.ts
     ```
   - Confirms orgn web integration contract unchanged

4. **Telemetry audit**
   - Grep `@sentry`, `stats`, `opencode.ai` in `packages/desktop`, `packages/app`:
     ```bash
     rg -n 'sentry|opencode\.ai|anomalyco' packages/desktop packages/app
     ```
   - Point Sentry DSN to orgn project or disable for confidential build (product decision)

5. **Visual regression (manual checklist)** — see below

### Validation

- [ ] `scripts/check-orgn-branding.sh` passes in CI
- [ ] Deep link unit tests pass
- [ ] SDK smoke tests pass (no API drift)
- [ ] No unexpected outbound URLs to `opencode.ai` in desktop network log during 5-min session (manual Charles/Proxyman optional)

### Stop Conditions

- **Stop** if SDK smoke fails — branding changes accidentally touched server routes; revert and isolate
- **Stop** if deep link tests reveal open redirect — fix before any public build
- **Stop** if Sentry still sends to OpenCode project — confidential data boundary violation

---

## Phase 5: Cleanup and Documentation

### Goal

Leave the fork maintainable: documented decisions, updated README, upstream merge notes, and explicit follow-up tickets.

### Expected File Changes

| File | Change |
|---|---|
| `packages/desktop/README.md` | orgn desktop dev instructions |
| `opencode-v2/README.md` | Note fork purpose; link to contract docs |
| `docs/contracts/orgn-desktop-v2-rebrand/DECISIONS.md` | Final state |
| `docs/contracts/orgn-desktop-v2-rebrand/audit-final.txt` | Zero-match proof |
| `packages/ui/src/theme/themes/opencode.json` | Comment header: legacy upstream theme, not default |
| `packages/ui/src/theme/themes/orng.json` | Comment: deprecated orgn orange experiment — do not use as default |

### Steps

1. **Remove dead transitional code** (only after one release cycle if dual scheme promised)
   - Legacy `opencode://` handler
   - Legacy storage key reads
   - `__OPENCODE__` window global

2. **Document merge strategy for upstream OpenCode pulls**
   - `docs/contracts/orgn-desktop-v2-rebrand/UPSTREAM-MERGE.md`:
     - Always re-apply brand module
     - Never take upstream `logo.tsx`, `electron-builder.config.ts`, `context.tsx` defaults blindly
     - i18n: merge keys, re-run locale sweep script

3. **File follow-up Linear tickets** (titles only):
   - Config path migration
   - id-orgn desktop auth
   - oLLM provider surface
   - CLI rename `lildax` → `orgn`

4. **Update orgn monorepo cross-reference**
   - Add note in `orgn/docs/opencode-providers-desktop-implementation.md` pointing to desktop v2 rebrand completion (optional, if team wants sync)

### Validation

- [ ] README accurately describes `bun run dev:desktop` and brand constants location
- [ ] `UPSTREAM-MERGE.md` reviewed by whoever owns fork merges
- [ ] Follow-up tickets filed
- [ ] Final branding grep matches baseline reduction (compare audit files)

### Stop Conditions

- **Stop** if removing legacy handlers before transition period ends — keep dual-read until DECISIONS.md says otherwise

---

## Commands To Run

| Purpose | Command |
|---|---|
| Install deps | `cd opencode-v2 && bun install` |
| Desktop dev | `bun run dev:desktop` |
| App unit tests | `bun --cwd packages/app test:unit` |
| UI typecheck | `bun --cwd packages/ui typecheck` |
| Desktop typecheck | `bun --cwd packages/desktop typecheck` |
| Monorepo typecheck | `bun run typecheck` |
| Theme preload test | `bun --cwd packages/app test:unit src/theme-preload.test.ts` |
| WSL model tests | `bun --cwd packages/app test:unit src/wsl/settings-model.test.ts` |
| SDK smoke | `bun --cwd packages/opencode test/server/httpapi-sdk.test.ts` |
| E2E (local) | `bun --cwd packages/app test:e2e:local` |
| Branding grep (manual gate) | `rg -n 'OpenCode|opencode\.ai' packages/desktop packages/app packages/ui` |
| Package desktop (macOS) | `bun --cwd packages/desktop package:mac` |
| Baseline audit | `rg -n 'OpenCode|opencode\.ai|opencode://' packages/desktop packages/app packages/ui > docs/contracts/orgn-desktop-v2-rebrand/audit-baseline.txt` |

---

## Manual QA Checklist

### First launch

- [ ] Cold start: splash shows orgn wordmark/mark on `#000000` ground
- [ ] Window title is “orgn” (or approved variant)
- [ ] Default theme is orgn dark — not oc-2, not orng orange
- [ ] No “OpenCode” visible in English UI within 2 minutes of exploration

### Core flows

- [ ] Open local folder → new session → send prompt → receive response
- [ ] Theme picker lists orgn as default; switching themes works
- [ ] Settings → General → language, appearance copy says orgn
- [ ] About / version shows orgn branding

### Deep links

- [ ] `orgn://open-project?directory=<valid-path>` opens project
- [ ] Legacy `opencode://open-project?directory=<valid-path>` still works (transition period)
- [ ] Malformed deep link does not crash app or execute unexpected navigation

### WSL (Windows only)

- [ ] WSL onboarding strings say orgn, not OpenCode
- [ ] Install/update actions still function (probe internals unchanged)

### Updates (beta/prod builds only)

- [ ] Update check dialog uses orgn copy
- [ ] Update feed is orgn-hosted (not GitHub anomalyco)

### Visual alignment

- [ ] Compare against v1 launchpad screenshot (black ground, orgn wordmark)
- [ ] Compare signal colors against `security-tokens.css` swatches
- [ ] Terminal panel readable; teal terminal text if themed

### Compatibility (regression)

- [ ] Existing `~/.config/opencode/opencode.json` still loads providers
- [ ] Project `.opencode/` agents/skills still discovered
- [ ] orgn web SDK client patterns unchanged (API smoke test green)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Wrong Electron appId breaks updates/codesign | Medium | High | New signing identity provisioned before beta; test on staging feed |
| Locale sweep breaks translation keys | Medium | Medium | Key parity script; native speaker spot-check top 5 locales |
| Premature config path rename breaks web CSB mode | Low | High | Compat mode explicitly in DECISIONS; defer path migration |
| Upstream merge reintroduces OpenCode branding | High | Medium | `UPSTREAM-MERGE.md` + CI grep gate |
| Provider dialog references dead OpenCode Zen URLs | Medium | Low | Hide or rewrite to orgn oLLM before ship |
| Icon assets missing in repo | Medium | Medium | Phase 0 generation from v1 SVGs |
| Dual deep link scheme confuses OAuth redirect | Low | Medium | Identity team registers both during transition |
| Sentry/telemetry leaks to OpenCode project | Low | High | Phase 4 telemetry audit |
| Theme JSON incomplete → broken contrast | Medium | Medium | Visual QA + compare v1 theme token mapping |
| Berkeley Mono licensing in desktop | Low | Medium | Legal review in Phase 0; fallback font documented |

---

## Definition Of Done

The rebrand epic is **done** when all of the following are true:

1. **Visual:** Installed desktop app (beta or prod channel) presents orgn logo, orgn name, and orgn default theme with zero OpenCode strings in primary English UI paths
2. **Technical:** OpenCode SDK/API smoke tests pass without modification to `packages/sdk/openapi.json`
3. **Persistence:** Theme and settings use orgn-prefixed storage keys with legacy read fallback documented
4. **Distribution:** Electron `appId`, artifact names, and protocol scheme use orgn namespace; update feed is orgn-controlled for beta/prod (or updater explicitly disabled with product approval)
5. **i18n:** All locale files in desktop/app/ui packages updated (allowlisted provider ID exceptions documented)
6. **Security:** Deep link validation tested; no open redirects; telemetry audit complete
7. **CI:** `scripts/check-orgn-branding.sh` (or equivalent) runs in PR checks
8. **Docs:** `DECISIONS.md`, `UPSTREAM-MERGE.md`, and README updates merged
9. **Follow-ups:** Separate tickets filed for config migration, id-orgn auth, oLLM, CLI rename — not blockers for this epic closure

---

## PR Sequence Summary

| PR | Phases | Merge gate |
|---|---|---|
| PR1 — Vertical slice | 0 + 1 | Dev smoke + typecheck + English UI review |
| PR2 — Full copy & persistence | 2 | Locale parity + unit tests + grep gate clean for en |
| PR3 — Distribution & edge UX | 3 | Packaged build + updater staging + e2e |
| PR4 — Tests & CI | 4 | SDK smoke + deep link tests + CI script |
| PR5 — Docs & cleanup | 5 | README + merge guide + follow-up tickets |

**Recommended next action after plan approval:** Execute Phase 0 (decisions + brand module + icon generation), then open PR1 with logo, `orgn.json`, Electron dev metadata, and English i18n core keys.
