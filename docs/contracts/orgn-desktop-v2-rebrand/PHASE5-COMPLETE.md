# Phase 5 Complete — ORGN Desktop v2 Rebrand

**Date:** 2026-06-06  
**Status:** Done — **program complete**

## Goal

Leave the fork maintainable: documented decisions, updated README, upstream merge notes, and explicit follow-up tickets.

## Deliverables

| Area | Change |
|---|---|
| **Desktop README** | `packages/desktop/README.md` — `dev:desktop`, brand module path, channels, CI gates |
| **Fork README** | `opencode-v2/README.md` — orgn fork banner + links to contract docs |
| **DECISIONS.md** | Final state — program completion table, CI gates, legacy retention policy |
| **UPSTREAM-MERGE.md** | Merge strategy for upstream OpenCode pulls |
| **FOLLOW-UP-TICKETS.md** | 11 Linear ticket titles for deferred work |
| **Theme docs** | `opencode.json` / `orng.json` names + `default-themes.ts` comments |
| **audit-final.txt** | Baseline comparison (579 → 0 banned matches) |
| **orgn monorepo xref** | Note in `orgn/docs/opencode-providers-desktop-implementation.md` |

## Intentionally NOT done (per stop conditions)

- Legacy `opencode://` handler — **kept** (one release cycle transition)
- Legacy storage read fallbacks — **kept**
- `__OPENCODE__` window global — **kept**
- `@opencode-ai/*` package renames — **out of scope**
- Console/web/stats rebrand — **out of scope**

## Validation checklist

- [x] README describes `bun run dev:desktop` and `packages/ui/src/brand/constants.ts`
- [x] `UPSTREAM-MERGE.md` covers protected files and merge workflow
- [x] Follow-up ticket titles documented (`FOLLOW-UP-TICKETS.md`)
- [x] Final audit compares to baseline reduction
- [x] `bash scripts/check-orgn-branding.sh` — pass
- [x] Theme legacy files annotated

## Definition of Done — program status

All phases 0–5 complete. Epic `feat/orgn-desktop-rebrand` ready for merge per `PR-STRATEGY.md`.

**Remaining work is follow-up tickets**, not rebrand program scope:
- Update manifest infra on DigitalOcean
- Codesign `com.orgn.desktop*`
- id-orgn auth, oLLM UI, config path migration, CLI rename

## Key commands (reference)

```bash
bun run dev:desktop
bash scripts/check-orgn-branding.sh
bash scripts/audit-orgn-telemetry.sh
bun --cwd packages/desktop test
bun --cwd packages/app test:unit src/pages/layout/deep-links.test.ts
```
