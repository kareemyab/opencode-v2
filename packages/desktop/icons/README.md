# Desktop Icons

Channel folders (`dev/`, `beta/`, `prod/`) supply assets copied to `resources/icons/` by `scripts/copy-icons.ts` during `predev` / `prebuild`.

## macOS app icon

Copied verbatim from `vscode-cde/resources/darwin/code.icns` → `icons/{channel}/icon.icns`.

```bash
cd packages/desktop
bun run generate:orgn-icons
```

## Regenerate all icons

Source assets:
- macOS: `vscode-cde/resources/darwin/code.icns`
- Windows/Linux rasters: `vscode-cde/resources/darwin/app-icon.svg`

```bash
cd packages/desktop
bun run generate:orgn-icons
```

**macOS:** `.icns` requires `iconutil` (built-in) to extract PNG fallbacks for dev.
