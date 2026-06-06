import { app } from "electron"

import { DESKTOP_STORAGE, LEGACY_DESKTOP_STORAGE } from "@opencode-ai/ui/brand"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.OPENCODE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

/** New electron-store name; legacy `opencode.settings` is read during migration. */
export const SETTINGS_STORE = DESKTOP_STORAGE.settings
export const LEGACY_SETTINGS_STORE = LEGACY_DESKTOP_STORAGE.settings
export const DEFAULT_SERVER_URL_KEY = "defaultServerUrl"
export const WSL_ENABLED_KEY = "wslEnabled"
export const PINCH_ZOOM_ENABLED_KEY = "pinchZoomEnabled"
export const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev"
