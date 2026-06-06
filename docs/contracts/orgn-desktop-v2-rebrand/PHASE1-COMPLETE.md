# Phase 1 Complete — ORGN Desktop v2 Rebrand

**Date:** 2026-06-06  
**Status:** Done — ready for Phase 2

## Goal

English vertical slice: orgn branding in window title, splash, default theme, core strings, Electron metadata, and deep links — without breaking sidecar boot or SDK/config compat.

## Deliverables

| Area | Change |
|---|---|
| Logo | `packages/ui/src/components/logo.tsx` — orgn mark, splash, wordmark from v1 SVG paths |
| Theme | `packages/ui/src/theme/themes/orgn.json` — dark-first monochrome + teal/violet signals |
| Theme context | Default `orgn`; brand storage keys with legacy read fallback; hide `opencode` theme in picker |
| Electron builder | `com.orgn.desktop.*`, `orgn://` + legacy `opencode://` protocols |
| Desktop main | Brand `APP_IDS`/`APP_NAMES`, dual protocol registration, dual deep-link argv filter |
| Settings store | Write `orgn.settings`; migrate from `opencode.settings` on boot |
| Deep links | `orgn://` primary; `__ORGN__` buffer with `__OPENCODE__` read fallback |
| English i18n | Zero `OpenCode` in `packages/desktop/src/renderer/i18n/en.ts` and `packages/app/src/i18n/en.ts` |
| Favicons | orgn assets wired in UI, desktop HTML, app/public symlinks |
| Theme preload | `oc-theme-preload.js` defaults to `orgn`; legacy key fallback |

## Validation checklist

- [x] `bun run typecheck` — `packages/ui`, `packages/app`, `packages/desktop`
- [x] `bun test src/brand/constants.test.ts` — 4/4
- [x] `bun test src/theme-preload.test.ts` — 3/3
- [x] `rg 'OpenCode' packages/desktop/src/renderer/i18n/en.ts packages/app/src/i18n/en.ts` — zero matches
- [x] Runtime compat preserved: `@opencode-ai/*` packages, `Global.Path`, sidecar username `opencode`, CLI command name unchanged

## Commands used

```bash
cd packages/ui && bun run typecheck && bun test src/brand/constants.test.ts
cd packages/app && bun run typecheck && bun test src/theme-preload.test.ts
cd packages/desktop && bun run typecheck
rg 'OpenCode' packages/desktop/src/renderer/i18n/en.ts packages/app/src/i18n/en.ts
```

## Phase 2 entry criteria met

- Vertical slice is visually and verbally orgn in English
- Brand module is wired through UI, app deep links, desktop shell, and theme system
- Legacy read paths documented and implemented for theme keys, deep links, settings store, global.dat

## Notes for Phase 2

1. Locale sweep across 15+ desktop/app/ui i18n files (use `i18n-replace-allowlist.txt`)
2. Full storage migration write path for renderer `orgn.global.dat`
3. WSL onboarding copy, desktop menu, provider dialog strings
4. External URL purge (`opencode.ai` → orgn URLs) in remaining app surfaces
5. `scripts/check-orgn-branding.sh` — expect significant burn-down from 579 baseline
