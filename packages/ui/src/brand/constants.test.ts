import { describe, expect, test } from "bun:test"
import {
  APP_IDS,
  APP_NAMES,
  DEEP_LINK_SCHEME,
  LEGACY_DEEP_LINK_SCHEME,
  ORGN_RADIUS_CSS,
  PRODUCT_NAME,
  THEME_ID_DEFAULT,
  THEME_STORAGE,
  LEGACY_THEME_STORAGE,
  isAnyDeepLink,
  storageKey,
  updatePublishUrl,
} from "./constants"

describe("orgn brand constants", () => {
  test("product identity", () => {
    expect(PRODUCT_NAME).toBe("orgn")
    expect(THEME_ID_DEFAULT).toBe("orgn")
  })

  test("electron ids by channel", () => {
    expect(APP_IDS.prod).toBe("com.orgn.desktop")
    expect(APP_NAMES.prod).toBe("orgn")
    expect(APP_NAMES.dev).toBe("CDE Agent")
  })

  test("storage key helpers", () => {
    expect(storageKey("settings")).toBe("orgn.settings")
    expect(THEME_STORAGE.themeId).toBe("orgn-theme-id")
    expect(LEGACY_THEME_STORAGE.themeId).toBe("opencode-theme-id")
  })

  test("deep link schemes", () => {
    expect(isAnyDeepLink("orgn://open-project?directory=/tmp")).toBe(true)
    expect(isAnyDeepLink("opencode://open-project?directory=/tmp")).toBe(true)
    expect(isAnyDeepLink("https://orgn.com")).toBe(false)
    expect(DEEP_LINK_SCHEME).toBe("orgn")
    expect(LEGACY_DEEP_LINK_SCHEME).toBe("opencode")
  })

  test("update publish urls", () => {
    expect(updatePublishUrl("dev")).toBeUndefined()
    expect(updatePublishUrl("prod")).toContain("orgn-desktop")
  })

  test("sharp corner radius tokens", () => {
    expect(ORGN_RADIUS_CSS).toContain("--radius-md: 0")
    expect(ORGN_RADIUS_CSS).toContain("--radius-xl: 0")
  })
})
