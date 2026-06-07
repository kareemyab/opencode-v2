# Desktop Icons

Channel folders (`dev/`, `beta/`, `prod/`) supply assets copied to `resources/icons/` by `scripts/copy-icons.ts` during `predev` / `prebuild`.

## Regenerate orgn icons

Source assets: `vscode-cde/resources/darwin/app-icon.svg` and `vscode-cde/resources/darwin/code.icns` (vector copy: `packages/ui/src/assets/orgn-app-icon.svg`)

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
- `dock.png` is the macOS squircle raster (`icon_128x128@2x.png` from `code.icns`). Use it for the dev dock icon — `icon.png` is a square canvas and looks wrong in the dock.
