# ORGN Desktop v2 — Upstream Merge Guide

> How to pull from upstream OpenCode (`anomalyco/opencode`) without losing the orgn rebrand.

**Last updated:** 2026-06-06 (Phase 5)

---

## Principle

Rebrand the **skin**, not the **plumbing**. Upstream changes to server routes, SDK, agents, and config loaders should merge normally. Upstream changes to branding, Electron metadata, themes, and i18n require manual re-application of orgn deltas.

See `DECISIONS.md` for locked compat-mode choices (`opencode.json`, `.opencode/`, `@opencode-ai/*` package names).

---

## Pre-merge checklist

1. Read upstream release notes / diff stat for `packages/desktop`, `packages/app`, `packages/ui`
2. Run `bash scripts/check-orgn-branding.sh` on current branch — must pass before merge
3. Run `bash scripts/audit-orgn-telemetry.sh` — confirm no new hardcoded vendor URLs
4. Note upstream changes to files in **Protected files** (below)

---

## Protected files — never take upstream blindly

| File / area | Why | orgn source of truth |
|---|---|---|
| `packages/ui/src/brand/*` | Product identity constants | orgn branch only |
| `packages/ui/src/components/logo.tsx` | orgn mark/wordmark | orgn branch |
| `packages/ui/src/theme/context.tsx` | Default theme `orgn`, storage keys | orgn branch |
| `packages/ui/src/theme/themes/orgn.json` | Default palette | orgn branch |
| `packages/desktop/electron-builder.config.ts` | `com.orgn.desktop*`, publish URLs | orgn branch |
| `packages/desktop/src/main/index.ts` | App IDs, protocol registration | merge carefully |
| `packages/desktop/scripts/copy-metainfo.ts` | Linux metadata | orgn branch |
| `packages/app/src/i18n/*` | User-visible copy | merge keys, re-run locale sweep |
| `packages/desktop/src/renderer/i18n/*` | Desktop shell copy | merge keys, re-run locale sweep |
| `packages/app/src/desktop-menu.ts` | Help links → orgn.com | orgn branch |
| `packages/app/src/pages/layout/deep-links.ts` | orgn:// + security validation | merge carefully |
| `scripts/check-orgn-branding.sh` | CI gate | orgn branch |
| `docs/contracts/orgn-desktop-v2-rebrand/*` | Contract docs | orgn branch |

---

## Safe to merge from upstream (usually)

- `packages/opencode/**` — server, CLI internals (user-visible CLI strings may need orgn pass)
- `packages/core/**`, `packages/sdk/**`
- Agent logic, provider IDs (`opencode`, `opencodeZen` — internal, not product name)
- Tests unrelated to branding
- `packages/console/**`, `packages/web/**`, `packages/stats/**` — out of rebrand scope

---

## Merge workflow

### 1. Fetch and merge upstream

```bash
git fetch upstream dev   # or your upstream remote name
git merge upstream/dev   # resolve conflicts file-by-file
```

### 2. Re-apply brand module

If upstream touched shared files, verify `@opencode-ai/ui/brand` imports still resolve:

```bash
cd packages/ui && bun run typecheck && bun test src/brand
```

### 3. i18n merge strategy

When upstream adds new i18n keys:

1. Merge structural changes into `packages/app/src/i18n/en.ts` and desktop `en.ts`
2. Propagate new keys to all locale files (copy English as placeholder if needed)
3. Grep for regressions:

```bash
rg 'OpenCode|opencode\.ai' packages/desktop packages/app packages/ui \
  --glob '*.ts' --glob '*.tsx' --glob '!*.test.ts'
```

4. Replace user-visible `OpenCode` → `orgn`, `opencode.ai` → orgn URLs per `DECISIONS.md`

### 4. Theme merge strategy

- **Default:** keep `orgn` as default in `theme/context.tsx`
- **Do not** restore upstream default `oc-2` or `opencode` theme as default
- Upstream community themes (dracula, nord, etc.) can merge freely
- `opencode.json` / `orng.json` are legacy — hidden from picker; see comments in `default-themes.ts`

### 5. Electron / desktop merge strategy

- Preserve `APP_IDS`, `APP_NAMES`, `ARTIFACT_NAME` from brand constants
- Preserve generic publish URLs (`UPDATE_PUBLISH_URLS`) — do not restore GitHub `anomalyco/opencode` publish config
- Keep dual protocol registration (`orgn` + legacy `opencode`) until transition period ends (see `DECISIONS.md`)

### 6. Validate

```bash
bun run typecheck
bash scripts/check-orgn-branding.sh
bash scripts/audit-orgn-telemetry.sh
bun --cwd packages/app test:unit src/pages/layout/deep-links.test.ts
bun --cwd packages/desktop test
bun --cwd packages/opencode test test/server/sdk-v1-smoke.test.ts
bun run dev:desktop   # manual smoke — splash, title, theme
```

---

## Conflict resolution quick reference

| Conflict in… | Resolution |
|---|---|
| `logo.tsx` | Keep orgn SVG components |
| `electron-builder.config.ts` | Keep orgn appId/productName/publish; take upstream build fixes only |
| `context.tsx` (theme) | Keep orgn default + storage migration; take upstream theme engine fixes |
| `en.ts` | Merge keys; orgn wording wins for product name / URLs |
| `deep-links.ts` | Keep orgn validation + legacy scheme support |
| `package.json` names | Keep `@opencode-ai/*` scopes (compat mode) |

---

## Post-merge audit

Regenerate comparison against baseline:

```bash
rg -n 'OpenCode|opencode\.ai' packages/desktop packages/app packages/ui \
  --glob '!node_modules' --glob '!**/*.md' --glob '!**/*.test.ts' \
  > docs/contracts/orgn-desktop-v2-rebrand/audit-post-merge.txt
```

Compare to `audit-final.txt`. Any new matches require explicit allowlist entry in `i18n-replace-allowlist.txt`.

---

## When to remove legacy transition code

**Not yet.** Keep until one release cycle after public beta:

- `opencode://` deep link read path
- `__OPENCODE__` window global
- Legacy storage key read fallbacks (`opencode.settings`, etc.)

Amend `DECISIONS.md` with removal date before deleting.
