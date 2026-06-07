import { describe, expect, test } from "bun:test"
import { MERMAID_THEME_CONFIG, createMermaidConfig } from "./mermaid-theme"

describe("mermaid theme", () => {
  test("uses dark node fills with light labels", () => {
    const vars = MERMAID_THEME_CONFIG.themeVariables
    expect(vars?.mainBkg).toBe("#27272a")
    expect(vars?.nodeTextColor).toBe("#f4f4f5")
    expect(vars?.primaryTextColor).toBe("#f4f4f5")
    expect(vars?.actorTextColor).toBe("#f4f4f5")
  })

  test("does not use light purple/yellow palette", () => {
    const vars = MERMAID_THEME_CONFIG.themeVariables
    expect(vars?.mainBkg).not.toBe("#e8e7ff")
    expect(vars?.clusterBkg).not.toBe("#ffffd6")
  })

  test("createMermaidConfig merges overrides", () => {
    const config = createMermaidConfig({ securityLevel: "loose" })
    expect(config.securityLevel).toBe("loose")
    expect(config.themeVariables?.mainBkg).toBe("#27272a")
  })
})
