import { describe, expect, test } from "bun:test"
import { normalizeMermaidSource } from "./markdown-mermaid"

describe("normalizeMermaidSource", () => {
  test("quotes square-bracket labels that contain parentheses", () => {
    const source = "ADR6[ADR-006: Delivery Modes (steer/queue/retry)]"
    expect(normalizeMermaidSource(source)).toBe('ADR6["ADR-006: Delivery Modes (steer/queue/retry)"]')
  })

  test("leaves labels without parentheses unchanged", () => {
    const source = "ADR1[ADR-001: Effect v4 as Runtime]"
    expect(normalizeMermaidSource(source)).toBe(source)
  })

  test("does not double-quote already quoted labels", () => {
    const source = 'ADR6["ADR-006: Delivery Modes (steer/queue/retry)"]'
    expect(normalizeMermaidSource(source)).toBe(source)
  })
})
