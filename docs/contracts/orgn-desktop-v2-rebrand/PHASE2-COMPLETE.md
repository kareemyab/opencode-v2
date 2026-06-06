# Phase 2 Complete — ORGN Desktop v2 Rebrand

**Date:** 2026-06-06  
**Status:** Done — ready for Phase 3

## Goal

Complete the rebrand across all locales, persistence keys, menus, WSL flows, and residual UI surfaces — without breaking runtime compat (`~/.config/opencode`, SDK, sidecar).

## Deliverables

| Area | Change |
|---|---|
| **Locale sweep** | All desktop (15), app (18), UI (16) locale files — `OpenCode` → `orgn`, Zen → orgn oLLM, URLs → orgn.com |
| **Storage migration** | `orgn.global.dat` + `orgn.settings` write path; legacy read fallback for `opencode.*` |
| **Persist layer** | `packages/app/src/utils/persist.ts` — orgn workspace/global storage with legacy fallbacks |
| **Desktop migrate** | Settings + global.dat one-time copy on boot |
| **WSL** | User-visible install/update/errors say orgn; internal probe kinds unchanged |
| **Menus** | `desktop-menu.ts`, `windows-app-menu.tsx` — orgn labels and orgn.com links |
| **Theme picker** | `orgn` first; hide `opencode` and `oc-2` from picker |
| **URL purge** | Zero `opencode.ai` in `packages/desktop`, `packages/app`, `packages/ui` |
| **CLI strings** | `cli/error.ts`, `cmd/uninstall.ts`, `session/retry.ts` user-facing copy |
| **Shiki/markdown** | Internal theme id `OpenCode` → `orgn` in `marked.tsx` + pierre |
| **Storybook** | Manager addon id → `orgn/theme-toggle` |
| **E2E fixtures** | Mock server rename + orgn display names in test paths |

## Validation checklist

- [x] `rg 'OpenCode' packages/desktop packages/app packages/ui --glob '*.ts' --glob '!*.test.ts'` — zero matches
- [x] `rg 'OpenCode' packages/desktop packages/app packages/ui --glob '*.tsx'` — zero matches
- [x] `rg 'opencode\.ai' packages/desktop packages/app packages/ui` — zero matches
- [x] `bun run typecheck` — ui, app, desktop
- [x] App tests — theme-preload, persist, WSL settings-model, i18n parity, layout helpers (45 pass)
- [x] UI tests — 31 pass
- [x] Desktop tests — migrate + WSL servers (9 pass)
- [x] Storage migration test — `packages/desktop/src/main/migrate.test.ts`
- [x] Global dat legacy fallback — `packages/app/src/utils/persist.test.ts`

## Commands used

```bash
cd packages/ui && bun run typecheck && bun test src
cd packages/app && bun run typecheck && bun test src/theme-preload.test.ts src/utils/persist.test.ts src/wsl/settings-model.test.ts src/i18n/parity.test.ts
cd packages/desktop && bun run typecheck && bun test src/main/migrate.test.ts src/main/wsl/servers.test.ts
rg 'OpenCode' packages/desktop packages/app packages/ui --glob '*.ts' --glob '!*.test.ts'
rg 'opencode\.ai' packages/desktop packages/app packages/ui
```

## Intentional compat preserved (allowlist)

- Provider IDs: `opencode`, `opencodeZen`, `opencodeGo`
- Config paths: `opencode.json`, `.opencode/`
- Legacy storage read keys: `opencode-theme-id`, `opencode.settings`, `opencode.global.dat`
- WSL internal job kinds: `probe-opencode`, `install-opencode`
- Legacy deep links: `opencode://`, `__OPENCODE__`
- Sidecar auth username: `opencode` (internal)
- CLI command name: `opencode` (compat)

## Notes for Phase 3

1. Updater pipeline — orgn-controlled publish URL (replace GitHub `anomalyco/opencode`)
2. Linux `.desktop` metadata via `copy-metainfo.ts` (partially updated; full packaging in Phase 3)
3. Error page / release notes / about panel polish
4. `scripts/check-orgn-branding.sh` CI gate activation (Phase 4)
5. Remaining `packages/opencode` plugin OAuth HTML pages (out of Phase 2 desktop-path scope)
