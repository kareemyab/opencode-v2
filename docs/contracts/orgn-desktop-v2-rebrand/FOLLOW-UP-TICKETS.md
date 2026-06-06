# ORGN Desktop v2 Rebrand — Follow-up Tickets

> Titles for Linear (or equivalent). File these after Phase 5 merge to main/epic. Not in scope for the rebrand program itself.

**Created:** 2026-06-06

---

## Infra & distribution

1. **Stand up orgn-desktop update manifests on DigitalOcean Spaces**
   - Publish `latest-*` JSON manifests at `UPDATE_PUBLISH_URLS` paths
   - Wire CI release pipeline for beta/prod channels

2. **Codesign and notarize `com.orgn.desktop*` app IDs**
   - macOS Developer ID + notarization
   - Windows Authenticode with orgn certificate
   - Match signing identity to new app IDs

3. **Configure orgn Sentry project for confidential desktop builds**
   - Replace env-only `VITE_SENTRY_DSN` with orgn-owned project
   - Document data boundary for TEE/confidential builds (disable vs. orgn DSN)

---

## Product & auth

4. **id-orgn desktop OAuth integration**
   - Separate contract; desktop auth flow against `id.orgn.com`

5. **oLLM provider surface in desktop UI**
   - Confidential inference gateway; separate from rebrand skin

6. **TEE attestation UI in desktop**
   - Follow-up contract; link to `ATTESTATION_URL`

---

## Runtime compat (deferred from rebrand)

7. **Config path migration: `opencode.json` → orgn namespace**
   - Migration tooling for `~/.config/opencode`, `.opencode/`, workspace stores
   - Breaking change — needs semver + user comms

8. **CLI rename: `lildax` / `opencode` command → `orgn`**
   - User-visible bin name; keep compat shim for one release

9. **Remove legacy deep link and storage transition code**
   - Drop `opencode://`, `__OPENCODE__`, legacy storage read fallbacks
   - Gate: one release cycle after public beta (see `DECISIONS.md`)

---

## Legal & polish

10. **Berkeley Mono licensing sign-off for desktop UI**
    - Ship font files to `packages/ui/src/assets/fonts/` after legal approval

11. **Rebrand `packages/console/*`, `packages/web`, `packages/stats/*`**
    - Out of desktop-path scope; separate program if needed

---

## Status

| Ticket | Owner | Status |
|---|---|---|
| 1–11 | _Unassigned_ | Not filed (titles only — create in Linear when ready) |
