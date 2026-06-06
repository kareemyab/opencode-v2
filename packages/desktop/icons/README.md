# Desktop Icons

Channel folders (`dev/`, `beta/`, `prod/`) supply assets copied to `resources/icons/` by `scripts/copy-icons.ts` during `predev` / `prebuild`.

## Regenerate orgn icons

Source SVG: `packages/ui/src/assets/orgn-app-icon.svg`

```bash
cd packages/desktop
bun run generate:orgn-icons
```

This renders PNG/ICO/ICNS for all channels and writes orgn favicon rasters to `packages/ui/src/assets/favicon/orgn-*`.

**macOS:** `.icns` requires `iconutil` (built-in).

**Note:** Packaged macOS icons may need Image2Icon Big Sur padding for final polish.

## Historical reference process

- Save source as `app-icon.png`
- `bun tauri icon -o src-tauri/icons/{environment}`
- Image2Icon Big Sur preset for `icon.icns` shadow/padding
- Keep `dock.png` synced with `icon_128x128@2x.png` from `icon.icns`
