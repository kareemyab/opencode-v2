#!/usr/bin/env bun
/**
 * Dev-only: rebrand the unpackaged `Electron.app` so the local app presents as
 * the branded desktop app instead of "Electron".
 *
 * In dev we run inside node_modules' generic `Electron.app`, so by default:
 *  - the macOS dock/menu shows "Electron" (its CFBundleName) — and `app.setName()`
 *    cannot change that label at runtime, and
 *  - overriding the icon via `app.dock.setIcon()` bypasses macOS's icon masking,
 *    rendering a flat full-bleed square.
 *
 * Patching the bundle's Info.plist (name) and bundle icon instead lets macOS mask
 * the icon natively (rounded squircle + shadow) — exactly how the packaged app and
 * vscode-cde (CDE.app) look. The source art stays full-bleed on purpose; the OS
 * applies the rounded-rect mask to bundle icons.
 *
 * Re-run on every `predev` because `bun install` recreates node_modules.
 * macOS only; no-op on other platforms.
 *
 * Usage: bun ./scripts/patch-dev-electron.ts [dev|beta|prod]
 */

import { $ } from "bun"
import electronExecPath from "electron"
import { copyFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { APP_IDS, APP_NAMES, DEV_DEEP_LINK_SCHEME } from "@opencode-ai/ui/brand"
import { resolveChannel } from "./utils"

if (process.platform !== "darwin") process.exit(0)

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

// `electron`'s default export is the path to the executable inside the .app bundle:
//   .../Electron.app/Contents/MacOS/Electron
const execPath = electronExecPath as unknown as string
const appBundle = execPath.replace(/\/Contents\/MacOS\/[^/]+$/, "")
if (!appBundle.endsWith(".app") || !existsSync(appBundle)) {
  console.warn(`patch-dev-electron: Electron.app not found (resolved "${appBundle}"); skipping`)
  process.exit(0)
}

const plist = join(appBundle, "Contents", "Info.plist")
const resources = join(appBundle, "Contents", "Resources")

// Unpackaged runs always present under the dev name — mirrors `app.setName()` in
// src/main/index.ts, which uses APP_NAMES.dev whenever `app.isPackaged` is false.
const name = APP_NAMES.dev

// Match the bundle's declared icon file (Electron defaults to "electron.icns").
const iconFile = (await $`/usr/libexec/PlistBuddy -c ${"Print :CFBundleIconFile"} ${plist}`.text())
  .trim()
const iconDest = join(resources, iconFile.endsWith(".icns") ? iconFile : `${iconFile || "electron"}.icns`)
const iconSrc = join(import.meta.dir, "..", "icons", channel, "icon.icns")

if (existsSync(iconSrc)) copyFileSync(iconSrc, iconDest)
else console.warn(`patch-dev-electron: icon not found at ${iconSrc} (run \`bun run generate:orgn-icons\`)`)

await $`/usr/libexec/PlistBuddy -c ${`Set :CFBundleName ${name}`} ${plist}`.quiet()
await $`/usr/libexec/PlistBuddy -c ${`Set :CFBundleDisplayName ${name}`} ${plist}`
  .quiet()
  .catch(() => $`/usr/libexec/PlistBuddy -c ${`Add :CFBundleDisplayName string ${name}`} ${plist}`.quiet())

// Declare the dev deep-link scheme (orgn-dev://) so macOS routes orgn-dev://auth-callback
// to THIS unpackaged bundle. setAsDefaultProtocolClient alone is ignored without an
// Info.plist declaration. Delete-then-add keeps it idempotent across predev re-runs.
await $`/usr/libexec/PlistBuddy -c ${"Delete :CFBundleURLTypes"} ${plist}`.quiet().catch(() => {})
for (const cmd of [
  "Add :CFBundleURLTypes array",
  "Add :CFBundleURLTypes:0 dict",
  `Add :CFBundleURLTypes:0:CFBundleURLName string ${APP_IDS.dev}`,
  "Add :CFBundleURLTypes:0:CFBundleURLSchemes array",
  `Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string ${DEV_DEEP_LINK_SCHEME}`,
]) {
  await $`/usr/libexec/PlistBuddy -c ${cmd} ${plist}`.quiet()
}

// Bump the bundle's mtime so LaunchServices/Dock refresh the icon on next launch.
await $`touch ${appBundle}`.quiet()

// Force Launch Services to re-read CFBundleURLTypes so orgn-dev:// resolves to this bundle
// immediately (otherwise it can resolve to "none" until the next relogin).
const lsregister =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
await $`${lsregister} -f ${appBundle}`.quiet().catch(() => {})

console.log(
  `patch-dev-electron: ${appBundle} → name "${name}", icon "${iconFile}", scheme "${DEV_DEEP_LINK_SCHEME}://" (${channel})`,
)
