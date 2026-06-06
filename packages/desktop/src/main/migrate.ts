import { app } from "electron"
import log from "electron-log/main.js"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { APP_IDS, DESKTOP_STORAGE, LEGACY_DESKTOP_STORAGE } from "@opencode-ai/ui/brand"
import { CHANNEL, LEGACY_SETTINGS_STORE, SETTINGS_STORE } from "./constants"
import { getStore } from "./store"

const TAURI_MIGRATED_KEY = "tauriMigrated"
const SETTINGS_MIGRATED_KEY = "settingsStoreMigrated"

function tauriDir(id: string) {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", id)
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), id)
    default:
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), id)
  }
}

const LEGACY_TAURI_APP_IDS = {
  dev: "ai.opencode.desktop.dev",
  beta: "ai.opencode.desktop.beta",
  prod: "ai.opencode.desktop",
} as const

function tauriAppIds() {
  const current = app.isPackaged ? APP_IDS[CHANNEL] : APP_IDS.dev
  const legacy = LEGACY_TAURI_APP_IDS[CHANNEL]
  return legacy === current ? [current] : [current, legacy]
}

function migrateFile(datPath: string, filename: string) {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(readFileSync(datPath, "utf-8"))
  } catch (err) {
    log.warn("tauri migration: failed to parse", filename, err)
    return
  }

  const legacySettingsName = `${LEGACY_SETTINGS_STORE}.dat`
  const nextSettingsName = `${SETTINGS_STORE}.dat`
  const storeName =
    filename === legacySettingsName || filename === nextSettingsName
      ? SETTINGS_STORE
      : filename === LEGACY_DESKTOP_STORAGE.globalDat || filename === "opencode.global.dat"
        ? DESKTOP_STORAGE.globalDat
        : filename
  const target = getStore(storeName)
  const migrated: string[] = []
  const skipped: string[] = []

  for (const [key, value] of Object.entries(data)) {
    if (target.has(key)) {
      skipped.push(key)
      continue
    }
    target.set(key, value)
    migrated.push(key)
  }

  log.log("tauri migration: migrated", filename, "→", storeName, { migrated, skipped })
}

function migrateSettingsStore() {
  if (getStore().get(SETTINGS_MIGRATED_KEY)) return

  const legacy = getStore(LEGACY_SETTINGS_STORE)
  const next = getStore(SETTINGS_STORE)
  const migrated: string[] = []

  for (const key of Object.keys(legacy.store)) {
    if (next.has(key)) continue
    next.set(key, legacy.get(key))
    migrated.push(key)
  }

  if (migrated.length > 0) {
    log.log("settings migration: copied legacy store keys", { migrated })
  }

  getStore().set(SETTINGS_MIGRATED_KEY, true)
}

const GLOBAL_DAT_MIGRATED_KEY = "globalDatMigrated"

function migrateGlobalDatStore() {
  if (getStore().get(GLOBAL_DAT_MIGRATED_KEY)) return

  const legacy = getStore(LEGACY_DESKTOP_STORAGE.globalDat)
  const next = getStore(DESKTOP_STORAGE.globalDat)
  const migrated: string[] = []

  for (const key of Object.keys(legacy.store)) {
    if (next.has(key)) continue
    next.set(key, legacy.get(key))
    migrated.push(key)
  }

  if (migrated.length > 0) {
    log.log("global dat migration: copied legacy store keys", { migrated })
  }

  getStore().set(GLOBAL_DAT_MIGRATED_KEY, true)
}

export function migrate() {
  migrateSettingsStore()
  migrateGlobalDatStore()

  if (getStore().get(TAURI_MIGRATED_KEY)) {
    log.log("tauri migration: already done, skipping")
    return
  }

  for (const id of tauriAppIds()) {
    const dir = tauriDir(id)
    log.log("tauri migration: checking", { dir, id })
    if (!existsSync(dir)) continue

    for (const filename of readdirSync(dir)) {
      if (!filename.endsWith(".dat")) continue
      migrateFile(join(dir, filename), filename)
    }
  }

  log.log("tauri migration: complete")
  getStore().set(TAURI_MIGRATED_KEY, true)
}
