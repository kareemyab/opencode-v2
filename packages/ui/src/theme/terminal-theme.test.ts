import { describe, expect, test } from "bun:test"
import orgnThemeJson from "./themes/orgn.json"
import theme2026 from "./themes/2026.json"
import lightPlus from "./themes/light-plus.json"
import { resolveTerminalTheme } from "./terminal-theme"
import type { DesktopTheme } from "./types"

const orgnTheme = orgnThemeJson as DesktopTheme
const theme2026Desktop = theme2026 as DesktopTheme
const lightPlusDesktop = lightPlus as DesktopTheme

describe("resolveTerminalTheme", () => {
  test("light themes use dark foreground on light background", () => {
    const resolved = resolveTerminalTheme(lightPlusDesktop, "light")
    expect(resolved.background.toLowerCase()).toBe("#ffffff")
    expect(resolved.foreground.toLowerCase()).toBe("#000000")
  })

  test("dark themes use light foreground on dark background", () => {
    const resolved = resolveTerminalTheme(theme2026Desktop, "dark")
    expect(resolved.background.toLowerCase()).toBe("#191a1b")
    expect(resolved.foreground.toLowerCase()).toBe("#bbbebf")
  })

  test("includes a full ansi palette for ghostty", () => {
    const resolved = resolveTerminalTheme(lightPlusDesktop, "light")
    expect(resolved.red).toMatch(/^#/)
    expect(resolved.brightWhite).toMatch(/^#/)
    expect(resolved.selectionBackground).toBe(resolved.foreground)
    expect(resolved.selectionForeground).toBe(resolved.background)
  })

  test("falls back when theme is missing", () => {
    const resolved = resolveTerminalTheme(undefined, "light")
    expect(resolved.background).toBe("#ffffff")
    expect(resolved.foreground).toBe("#000000")
  })

  test("orgn inline theme resolves for both modes", () => {
    const light = resolveTerminalTheme(orgnTheme, "light")
    const dark = resolveTerminalTheme(orgnTheme, "dark")
    expect(light.background).not.toBe(dark.background)
  })
})
