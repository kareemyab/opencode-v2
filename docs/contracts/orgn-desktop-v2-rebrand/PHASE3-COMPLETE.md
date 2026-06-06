# Phase 3 Complete — ORGN Desktop v2 Rebrand

**Date:** 2026-06-06  
**Status:** Done — ready for Phase 4

## Goal

Polish updater, About/metadata, failure UX, Linux packaging, and E2E alignment at the edges users hit when installing, updating, or when things go wrong.

## Deliverables

| Area | Change |
|---|---|
| **Updater pipeline** | `electron-builder.config.ts` — generic publish URL via `updatePublishUrl()` (DigitalOcean pattern); no GitHub `anomalyco/opencode` |
| **Brand constants** | `UPDATE_PUBLISH_URLS`, `updatePublishUrl()` with `ORGN_UPDATE_URL` override |
| **Main-process i18n** | `packages/desktop/src/main/i18n.ts` — native updater dialogs use `desktop.updater.*` keys + locale from `orgn.global.dat` |
| **Updater dialogs** | `updater.ts` — localized title/message/buttons; feed URL logged at startup |
| **Linux metadata** | `copy-metainfo.ts` — `com.orgn.desktop*` app IDs, orgn developer/URLs, `.desktop` `Name`/`Comment` |
| **Window chrome** | `windows.ts` — default background `#000000` / orgn light surface (removed `oc-2` dependency) |
| **Package metadata** | `package.json` author email → `hello@orgn.com` |
| **Help menu** | `desktop-menu.ts` — feedback/bug links → `SUPPORT_URL` |
| **Error page** | Support link uses `SUPPORT_URL` + link icon; i18n label no longer says "Discord" |
| **Docs** | `packages/desktop/README.md`, `icons/README.md` — orgn voice |
| **Desktop i18n** | Added `desktop.updater.downloaded.restart` / `.later` across all desktop locales |

## Validation checklist

- [x] Zero `OpenCode` / `opencode.ai` in `packages/desktop`, `packages/app`, `packages/ui` (ts/tsx)
- [x] `bun run typecheck` — ui, app, desktop
- [x] UI brand tests — 5 pass (includes `updatePublishUrl`)
- [x] App tests — theme-preload, persist, i18n parity — 17 pass
- [x] Desktop tests — migrate — 1 pass
- [x] `copy-metainfo.ts prod` generates `com.orgn.desktop.desktop` with orgn Name/Comment
- [ ] Packaged `.dmg` / AppImage visual check — manual (requires codesign infra)
- [ ] Updater check against staging feed — blocked on infra ticket (feed URLs configured, not yet live)
- [ ] E2E smoke (`test:e2e:local`) — not run (requires Playwright + desktop binary; fixtures already orgn-aligned from Phase 2)

## Intentional compat preserved

- `migrate.ts` `LEGACY_TAURI_APP_IDS` still references `ai.opencode.desktop*` for one-time data migration
- `store.ts` comment documents legacy path layout
- Dev channel updater remains disabled via `UPDATER_ENABLED`

## Notes for Phase 4

1. Activate `scripts/check-orgn-branding.sh` in CI (will need allowlist entry for `migrate.ts` legacy Tauri IDs)
2. Deep link security tests — `deep-links.test.ts`, protocol handler tests
3. SDK smoke — `packages/opencode/test/server/sdk-v1-smoke.test.ts` unchanged
4. Post-implementation audit — `audit-final.txt`
5. Infra: stand up orgn-desktop update manifests at configured DigitalOcean paths before public beta
