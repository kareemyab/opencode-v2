# Phase 4 Complete — ORGN Desktop v2 Rebrand

**Date:** 2026-06-06  
**Status:** Done — ready for Phase 5

## Goal

Prevent brand regression and secure deep-link inputs — without claiming SOC2 completeness.

## Deliverables

| Area | Change |
|---|---|
| **Deep link validation** | `deep-links.ts` — host allowlist, reject credentials/ports, absolute path-only `directory`, control-char filtering |
| **Deep link tests** | `deep-links.test.ts` — orgn + legacy scheme cases, injection attempts, credential rejection |
| **Protocol registration** | `deep-link-protocol.ts` + tests — registers `orgn` + legacy `opencode` schemes; argv extraction |
| **Main process** | `index.ts` uses extracted protocol helpers |
| **CI branding gate** | `scripts/check-orgn-branding.sh` — activated in `.github/workflows/typecheck.yml` |
| **Telemetry audit** | `scripts/audit-orgn-telemetry.sh` — no hardcoded `opencode.ai`/`anomalyco`/`sentry.io` in runtime source |
| **Final audit** | `audit-final.txt` — zero-match proof for banned patterns |
| **Desktop tests** | `packages/desktop` — `test` / `test:ci` scripts added |
| **WSL test copy** | Renamed stray "OpenCode step" test name → orgn |

## Validation checklist

- [x] `bash scripts/check-orgn-branding.sh` — pass
- [x] `bash scripts/audit-orgn-telemetry.sh` — pass (Sentry env-gated via `VITE_SENTRY_DSN`; no bundled DSN)
- [x] Deep link unit tests — 9 pass (`deep-links.test.ts`)
- [x] Protocol registration tests — 2 pass (`deep-link-protocol.test.ts`)
- [x] SDK smoke — `sdk-v1-smoke.test.ts` (4 pass)
- [x] HttpApi SDK regression — `httpapi-sdk.test.ts` (18 pass)
- [x] `audit-final.txt` committed with zero banned matches
- [x] CI: branding + telemetry audits wired into `typecheck.yml`
- [ ] Manual 5-min network log check — optional (Proxyman/Charles)

## Security decisions

| Topic | Decision |
|---|---|
| Deep link hosts | Only `open-project`, `new-session` |
| Directory param | Must be absolute filesystem path; rejects `://`, relative paths, null bytes |
| Legacy scheme | `opencode://` uses same validation path as `orgn://` |
| Sentry | Init only when `VITE_SENTRY_DSN` is set at build time — no default OpenCode DSN |
| Branding allowlist | `migrate.ts` legacy Tauri IDs; `opencode://` in tests; npm/github deps excluded from anomalyco scan |

## Notes for Phase 5

1. README updates (`opencode-v2/README.md`, theme file comments)
2. `UPSTREAM-MERGE.md` — merge strategy for upstream OpenCode pulls
3. Follow-up ticket titles (config migration, id-orgn auth, oLLM surface)
4. Optional: remove legacy transitional code after one release cycle (not yet)
