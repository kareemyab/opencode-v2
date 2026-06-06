# ORGN Desktop v2 Rebrand — PR Strategy

Epic branch: **`feat/orgn-desktop-rebrand`**

Each PR merges to epic; epic merges to main when Definition of Done is met.

| PR | Phases | Title (suggested) | Merge gate |
|---|---|---|---|
| PR0 | Phase 0 | `chore(desktop): orgn rebrand safety setup — brand module, assets, audit` | DECISIONS.md + brand module typecheck + icons generated + audit baseline |
| PR1 | Phase 1 | `feat(desktop): orgn vertical slice — logo, theme, electron metadata, en i18n` | `bun run dev:desktop` smoke + English UI review |
| PR2 | Phase 2 | `feat(desktop): orgn locale sweep + storage migration` | All locale files + unit tests + grep clean |
| PR3 | Phase 3 | `feat(desktop): orgn distribution + updater + packaged builds` | Signed staging build + e2e subset |
| PR4 | Phase 4 | `ci(desktop): orgn branding gate + deep link tests` | CI script + SDK smoke |
| PR5 | Phase 5 | `docs(desktop): orgn rebrand cleanup + upstream merge guide` | README + follow-up tickets filed |

**Rule:** No PR renames `@opencode-ai/*`, touches OpenAPI, or migrates `Global.Path` without explicit approval comment linking to DECISIONS.md amendment.
