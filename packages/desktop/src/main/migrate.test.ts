import { beforeEach, describe, expect, mock, test } from "bun:test"

const storeData = new Map<string, Map<string, unknown>>()

mock.module("electron", () => ({
  app: {
    isPackaged: false,
    getPath: () => "/tmp/orgn-test",
  },
}))

mock.module("electron-log/main.js", () => ({
  default: {
    log: () => undefined,
    warn: () => undefined,
  },
}))

mock.module("./constants", () => ({
  CHANNEL: "dev",
  SETTINGS_STORE: "orgn.settings",
  LEGACY_SETTINGS_STORE: "opencode.settings",
}))

mock.module("./store", () => ({
  getStore: (name = "orgn.settings") => {
    if (!storeData.has(name)) storeData.set(name, new Map())
    const data = storeData.get(name)!
    return {
      store: Object.fromEntries(data),
      has: (key: string) => data.has(key),
      get: (key: string) => data.get(key),
      set: (key: string, value: unknown) => {
        data.set(key, value)
      },
    }
  },
}))

describe("desktop migrate", () => {
  beforeEach(() => {
    storeData.clear()
  })

  test("copies legacy settings and global dat keys into orgn stores", async () => {
    storeData.set("opencode.settings", new Map([["defaultServerUrl", "http://127.0.0.1:4096"]]))
    storeData.set("opencode.global.dat", new Map([["language", '{"locale":"en"}']]))

    const { migrate } = await import("./migrate")
    migrate()

    expect(storeData.get("orgn.settings")?.get("defaultServerUrl")).toBe("http://127.0.0.1:4096")
    expect(storeData.get("orgn.global.dat")?.get("language")).toBe('{"locale":"en"}')
    expect(storeData.get("orgn.settings")?.get("settingsStoreMigrated")).toBe(true)
    expect(storeData.get("orgn.settings")?.get("globalDatMigrated")).toBe(true)
  })
})
