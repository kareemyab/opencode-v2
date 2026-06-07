import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  CURATED_THEME_DEFAULT_KEY,
  CURATED_THEME_ENTRIES,
  CURATED_THEME_IDS,
  curatedEntryForKey,
  curatedEntryForThemeId,
  curatedThemeIds,
  isCuratedThemeKey,
  isCuratedThemeId,
  resolveCuratedKey,
} from "./curated-themes"

const themesDir = join(import.meta.dir, "themes")

describe("curated-themes registry", () => {
  test("has exactly 40 entries in vscode order", () => {
    expect(CURATED_THEME_ENTRIES.length).toBe(40)
    expect(CURATED_THEME_ENTRIES[0]?.label).toBe("Light 2026")
    expect(CURATED_THEME_ENTRIES[11]?.label).toBe("ORGN Original Black")
    expect(CURATED_THEME_ENTRIES[39]?.label).toBe("SynthWave '84")
  })

  test("uses unique curated keys", () => {
    const keys = CURATED_THEME_ENTRIES.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test("every curated theme slug has a JSON file on disk", () => {
    for (const slug of CURATED_THEME_IDS) {
      expect(existsSync(join(themesDir, `${slug}.json`))).toBe(true)
    }
  })

  test("curatedThemeIds filters to known slugs only", () => {
    const filtered = curatedThemeIds(["flexoki", "dracula", "2026", "nord"])
    expect(filtered).toEqual(["2026", "flexoki"])
  })

  test("resolveCuratedKey migrates legacy values", () => {
    expect(resolveCuratedKey(null, "orgn", "system")).toBe(CURATED_THEME_DEFAULT_KEY)
    expect(resolveCuratedKey(null, "dracula", "dark")).toBe(CURATED_THEME_DEFAULT_KEY)
    expect(resolveCuratedKey("flexoki-light", "flexoki", "dark")).toBe("flexoki-light")
    expect(resolveCuratedKey(null, "flexoki", "light")).toBe("flexoki-light")
    expect(resolveCuratedKey(null, "flexoki", "dark")).toBe("flexoki-dark")
  })

  test("alias entries share theme files", () => {
    const original = curatedEntryForKey("orgn-original-black")
    const dark2026 = curatedEntryForKey("2026-dark")
    expect(original?.themeId).toBe("2026")
    expect(dark2026?.themeId).toBe("2026")
    expect(original?.label).not.toBe(dark2026?.label)
  })

  test("scheme-locked entries resolve by theme id and scheme", () => {
    expect(curatedEntryForThemeId("flexoki", "dark")?.key).toBe("flexoki-dark")
    expect(curatedEntryForThemeId("flexoki", "light")?.key).toBe("flexoki-light")
    expect(isCuratedThemeKey("kanagawa-wave")).toBe(true)
    expect(isCuratedThemeId("flexoki")).toBe(true)
    expect(isCuratedThemeId("dracula")).toBe(false)
  })
})
