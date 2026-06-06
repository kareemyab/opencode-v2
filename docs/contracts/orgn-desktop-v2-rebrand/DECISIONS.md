# ORGN Desktop v2 Rebrand — Locked Decisions

> **Status: IMPLEMENTED** (2026-06-06, Phases 0–5 complete).  
> Product may override before public beta; this document is the final decision record for the desktop rebrand program.

## Program completion

| Phase | Status | Artifact |
|---|---|---|
| 0 — Safety setup | Done | `PHASE0-COMPLETE.md`, brand module, baseline audit |
| 1 — Vertical slice | Done | `PHASE1-COMPLETE.md` |
| 2 — Locale + storage | Done | `PHASE2-COMPLETE.md` |
| 3 — Distribution + UX | Done | `PHASE3-COMPLETE.md` |
| 4 — Security + CI gates | Done | `PHASE4-COMPLETE.md`, `audit-final.txt` |
| 5 — Docs + cleanup | Done | `PHASE5-COMPLETE.md`, `UPSTREAM-MERGE.md` |

**CI gates (active):** `scripts/check-orgn-branding.sh`, `scripts/audit-orgn-telemetry.sh` in `.github/workflows/typecheck.yml`

**Legacy transition (retained):** `opencode://`, `__OPENCODE__`, legacy storage read fallbacks — remove after one release cycle (see `FOLLOW-UP-TICKETS.md` #9).

---

## Product identity

| Decision | Choice | Rationale |
|---|---|---|
| User-facing product name | **orgn** | Matches orgn.com positioning and web product |
| Desktop-specific name | **orgn** (`PRODUCT_NAME_DESKTOP`) | Same as product; no separate “OpenCode Desktop” string |
| Subtitle / tagline (optional UI) | **Confidential Development Environment** | Aligns with CDE framing in product context; not the window title |
| Installer directory (Windows) | **orgn** | Matches v1 `win32DirName` pattern in `vscode-cde/product.json` |
| v1 “CDE” window title | **Not used** for v2 primary title | v1 used CDE in chrome; v2 standardizes on orgn externally |

## Electron & OS registration

| Channel | `appId` | `productName` |
|---|---|---|
| dev | `com.orgn.desktop.dev` | orgn Dev |
| beta | `com.orgn.desktop.beta` | orgn Beta |
| prod | `com.orgn.desktop` | orgn |

| Decision | Choice |
|---|---|
| Artifact name pattern | `orgn-desktop-${os}-${arch}.${ext}` |
| RPM package name (prod) | `orgn-desktop` |
| Deep link scheme (primary) | `orgn://` |
| Legacy deep link scheme | `opencode://` — **read-only alias for one release** |
| Deep link event name | `orgn:deep-link` (legacy: `opencode:deep-link` read in transition) |
| Window global for pending links | `__ORGN__` (legacy read from `__OPENCODE__`) |

## Runtime compatibility (config strategy)

| Decision | Choice | Rationale |
|---|---|---|
| XDG app slug (`~/.config/…`) | **Keep `opencode`** | orgn web + existing users; no data migration in v1 |
| Project config directory | **Keep `.opencode/`** | Hundreds of tests and web CSB integration |
| Config filenames | **Keep `opencode.json` / `opencode.jsonc`** | Loader paths in `packages/opencode/src/config/config.ts` |
| Sidecar default auth username | **Keep `opencode` internally** | Localhost basic auth; user-visible copy says orgn in Phase 2+ |
| OpenAPI / SDK | **No changes** | `orgn/apps/agent/lib/opencode/` depends on stable API |

**Mode name:** **compat mode** — rebrand the skin, not the plumbing.

## Theme & typography

| Decision | Choice |
|---|---|
| Default theme id | `orgn` |
| Theme style element id | `orgn-theme` (legacy read: `oc-theme`) |
| Theme storage keys (write) | `orgn-theme-id`, `orgn-color-scheme`, etc. |
| Theme storage keys (read fallback) | `opencode-theme-id`, `opencode-color-scheme`, etc. |
| Electron settings store | `orgn.settings` (fallback read: `opencode.settings`) |
| Global dat store file | `orgn.global.dat` (fallback read: `opencode.global.dat`) |
| Primary UI font (Phase 1+) | **System monospace stack** for slice 1; Berkeley Mono in Phase 1 if files shipped to `packages/ui/src/assets/fonts/` |
| Berkeley Mono licensing | **Pending legal sign-off** — Phase 1 uses `ui-monospace, SF Mono, Menlo, monospace` until cleared |

### orgn theme palette (dark default)

Derived from `orgn/apps/agent/styles/security-tokens.css` and v1 `orgn_cde_black.json`:

| Token | Hex | Usage |
|---|---|---|
| Surface void | `#000000` | Backgrounds |
| Surface raised | `#141414` | Ghost gray panels |
| Border | `#1F1F1F` | Chrome borders |
| Text primary | `#FFFFFF` | Headings |
| Text secondary | `#CCCCCC` | Body |
| Signal primary (Spectral Teal) | `#2FFFD7` | Active/progress/terminal |
| Signal accent (Electric Violet) | `#7A5CFF` | Focus rings |
| Info (Diffraction Blue) | `#4FA8FF` | Informational |
| Error | `#ff3333` | Errors only |

## URLs

| Constant | URL |
|---|---|
| `COMPANY_URL` | `https://orgn.com` |
| `DOCS_URL` | `https://orgn.com/docs` |
| `SUPPORT_URL` | `https://orgn.com/support` |
| `ID_URL` | `https://id.orgn.com` |
| `API_URL` | `https://api.orgn.com` |
| `APP_URL` | `https://cde.orgn.com` |
| `ATTESTATION_URL` | `https://attest.daytona.orgn.com` |

Replace all user-visible `opencode.ai` links with the above in desktop path (Phase 1+).

## Distribution & updates

| Decision | Status |
|---|---|
| Update feed (prod/beta) | **Configured** — generic provider at `origin-agent.sfo3.digitaloceanspaces.com/orgn-desktop*`; override with `ORGN_UPDATE_URL`. Manifests not yet published (infra ticket). |
| Dev channel updater | **Disabled** (existing `UPDATER_ENABLED` when unpackaged/dev) |
| Codesign identity | **Unknown** — must match new `com.orgn.desktop*` app IDs |
| Interim prod publish config | Generic orgn feed URLs in `electron-builder.config.ts`; dev updater disabled |

## Explicit non-goals (this program)

- Rename `@opencode-ai/*` packages
- Rebrand `packages/console/*`, `packages/web`, `packages/stats/*`
- id-orgn OAuth UI (separate contract)
- oLLM / attestation UI (separate contract)
- Config path migration tooling

## Recon unknowns — resolution status

| Unknown | Resolution |
|---|---|
| Shipping name orgn vs CDE | **orgn** (CDE = tagline only) |
| Config path migration | **Deferred** — compat mode |
| CLI command name | **Deferred** — keep `lildax` bin + internal opencode paths; user strings say orgn in Phase 2 |
| Deep link scheme | **orgn://** + legacy alias |
| Update/signing infra | **Open infra ticket** — blocking for beta only |
| Icon asset source | **Resolved Phase 0** — generated from `orgn-app-icon.svg` |
| Font strategy | **System mono slice 1**; Berkeley Mono after legal |
| id-orgn + oLLM scope | **Follow-up contracts** |
| Console/web/stats | **Out of scope** |
| TEE attestation UI | **Follow-up contract** — see `FOLLOW-UP-TICKETS.md` |

## Related docs

| Doc | Purpose |
|---|---|
| `UPSTREAM-MERGE.md` | Merge upstream OpenCode without losing rebrand |
| `FOLLOW-UP-TICKETS.md` | Linear ticket titles for deferred work |
| `PR-STRATEGY.md` | PR sequence for epic merge |
| `audit-baseline.txt` | Pre-rebrand grep (579 lines) |
| `audit-final.txt` | Post-rebrand zero-match proof |
| `i18n-replace-allowlist.txt` | Intentional `opencode` compat patterns |
