# Phase 0 Complete — ORGN Desktop v2 Rebrand

**Date:** 2026-06-06  
**Status:** Done — ready for Phase 1

## Deliverables

| Item | Location |
|---|---|
| Locked decisions | `DECISIONS.md` |
| PR sequence | `PR-STRATEGY.md` |
| i18n sweep allowlist | `i18n-replace-allowlist.txt` |
| Baseline audit (579 matches) | `audit-baseline.txt` |
| Brand constants module | `packages/ui/src/brand/` |
| Brand unit tests | `packages/ui/src/brand/constants.test.ts` |
| Logo SVGs (from v1) | `packages/ui/src/assets/orgn-logo-wordmark.svg`, `orgn-logo-mark.svg` |
| App icon source | `packages/ui/src/assets/orgn-app-icon.svg` |
| Favicon source | `packages/ui/src/assets/favicon/orgn-favicon.svg` |
| Generated favicon rasters | `packages/ui/src/assets/favicon/orgn-*.{png,ico,webmanifest}` |
| Electron icons (dev/beta/prod) | `packages/desktop/icons/{dev,beta,prod}/` |
| Icon generation script | `packages/desktop/scripts/generate-orgn-icons.ts` |
| CI branding gate (Phase 4 — will fail until Phase 1+) | `scripts/check-orgn-branding.sh` |

## Validation checklist

- [x] `DECISIONS.md` covers all recon unknowns with defaults
- [x] Brand module exports and typechecks (`bun run typecheck` in `packages/ui`)
- [x] Brand tests pass (4/4)
- [x] Icon files at `electron-builder.config.ts` paths after `copy-icons.ts dev`
- [x] Baseline audit committed (`audit-baseline.txt` — 579 lines to burn down)
- [x] No circular dependency: brand module is standalone; desktop does not import it yet

## Commands used

```bash
cd packages/desktop
bun install
bun run generate:orgn-icons
bun ./scripts/copy-icons.ts dev
```

## Phase 1 entry criteria met

- Product name, app IDs, theme id, storage key strategy, and URL constants are codified in `@opencode-ai/ui/brand`
- orgn logo and icon assets exist and are wired for generation
- Baseline grep provides diff target for Phase 1 PR

## Notes for Phase 1

1. Import `@opencode-ai/ui/brand` in `electron-builder.config.ts`, `desktop/src/main/index.ts`, `logo.tsx`, `theme/context.tsx`, etc.
2. Wire `packages/app/public` favicon symlinks to `orgn-*` rasters (or replace v3 symlinks)
3. Run `scripts/check-orgn-branding.sh` after English slice — expect failure until copy replaced
4. Berkeley Mono: still pending legal — use system mono per DECISIONS.md
