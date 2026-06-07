import { describe, expect, test } from "bun:test"
import { resolveThemeVariant, themeToCss } from "../src/theme/resolve"
import { resolveThemeVariantV2, themeV2ToCss } from "../src/theme/v2/resolve"
import flexoki from "../src/theme/themes/flexoki.json"
import orgnCdeBlack from "../src/theme/themes/orgn-cde-black.json"
import type { DesktopTheme } from "../src/theme/types"

describe("convert-vscode-theme output", () => {
  test("flexoki dark resolves core CSS variables", () => {
    const theme = flexoki as DesktopTheme
    const tokens = resolveThemeVariant(theme.dark, true)
    const css = themeToCss(tokens)
    expect(css).toContain("--background-base:")
    expect(css).toContain("--text-strong:")
    expect(css).toContain("--syntax-keyword:")
    expect(theme.dark.palette?.neutral.toLowerCase()).toBe("#100f0f")
  })

  test("orgn cde black uses true black background", () => {
    const theme = orgnCdeBlack as DesktopTheme
    expect(theme.dark.palette?.neutral.toLowerCase()).toBe("#000000")
    const v2 = themeV2ToCss(resolveThemeVariantV2(theme.dark, true))
    expect(v2).toContain("--v2-grey-")
  })
})
