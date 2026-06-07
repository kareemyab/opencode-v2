import { describe, expect, test } from "bun:test"
import { groupParts } from "./message-part-group"
import { readPartText } from "./message-part-text"

describe("groupParts", () => {
  const messageID = "msg_1"

  const bash = (id: string) =>
    ({
      id,
      type: "tool",
      tool: "bash",
      state: { status: "completed", input: {} },
    }) as import("@opencode-ai/sdk/v2").Part

  const read = (id: string) =>
    ({
      id,
      type: "tool",
      tool: "read",
      state: { status: "completed", input: {} },
    }) as import("@opencode-ai/sdk/v2").Part

  test("groups three or more consecutive shell commands", () => {
    const groups = groupParts([
      { messageID, part: bash("a") },
      { messageID, part: bash("b") },
      { messageID, part: bash("c") },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.type).toBe("shell")
    if (groups[0]?.type !== "shell") return
    expect(groups[0].refs.map((ref) => ref.partID)).toEqual(["a", "b", "c"])
  })

  test("keeps one or two consecutive shell commands ungrouped", () => {
    const groups = groupParts([
      { messageID, part: bash("a") },
      { messageID, part: bash("b") },
    ])

    expect(groups).toHaveLength(2)
    expect(groups.every((group) => group.type === "part")).toBe(true)
  })

  test("splits shell runs when interrupted by other tools", () => {
    const groups = groupParts([
      { messageID, part: bash("a") },
      { messageID, part: bash("b") },
      { messageID, part: bash("c") },
      { messageID, part: read("d") },
      { messageID, part: bash("e") },
    ])

    expect(groups).toHaveLength(3)
    expect(groups[0]?.type).toBe("shell")
    expect(groups[1]?.type).toBe("context")
    expect(groups[2]?.type).toBe("part")
  })
})

describe("readPartText", () => {
  test("returns empty string when accum is undefined and part text is undefined", () => {
    expect(readPartText(undefined, { id: "part_1" })).toBe("")
  })

  test("returns trimmed part text when accum is undefined", () => {
    expect(readPartText(undefined, { id: "part_1", text: "  hello  " })).toBe("hello")
  })

  test("prefers accum value over part text when accum has a hit", () => {
    expect(readPartText({ part_1: "  from accum  " }, { id: "part_1", text: "from part" })).toBe("from accum")
  })

  test("falls back to part text when accum misses", () => {
    expect(readPartText({ other_part: "ignored" }, { id: "part_1", text: "  from part  " })).toBe("from part")
  })

  test("returns empty string for whitespace-only text", () => {
    expect(readPartText(undefined, { id: "part_1", text: "   \n\t  " })).toBe("")
  })

  test("trims leading and trailing whitespace", () => {
    expect(readPartText(undefined, { id: "part_1", text: "\n  body  \n" })).toBe("body")
  })
})
