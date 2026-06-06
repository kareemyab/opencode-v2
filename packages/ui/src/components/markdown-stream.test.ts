import { describe, expect, test } from "bun:test"
import { hasOpenTrailingFence, stream } from "./markdown-stream"

describe("markdown stream", () => {
  test("heals incomplete emphasis while streaming", () => {
    expect(stream("hello **world", true)).toEqual([{ raw: "hello **world", src: "hello **world**", mode: "live" }])
    expect(stream("say `code", true)).toEqual([{ raw: "say `code", src: "say `code`", mode: "live" }])
  })

  test("keeps incomplete links non-clickable until they finish", () => {
    expect(stream("see [docs](https://example.com/gu", true)).toEqual([
      { raw: "see [docs](https://example.com/gu", src: "see docs", mode: "live" },
    ])
  })

  test("splits an unfinished trailing code fence from stable content", () => {
    expect(stream("before\n\n```ts\nconst x = 1", true)).toEqual([
      { raw: "before\n\n", src: "before\n\n", mode: "live" },
      { raw: "```ts\nconst x = 1", src: "```ts\nconst x = 1", mode: "live" },
    ])
  })

  test("keeps reference-style markdown as one block", () => {
    expect(stream("[docs][1]\n\n[1]: https://example.com", true)).toEqual([
      {
        raw: "[docs][1]\n\n[1]: https://example.com",
        src: "[docs][1]\n\n[1]: https://example.com",
        mode: "live",
      },
    ])
  })

  test("detects an open trailing code fence", () => {
    expect(hasOpenTrailingFence("before\n\n```ts\nconst x = 1")).toBe(true)
    expect(hasOpenTrailingFence("before\n\n```mermaid\ngraph TD\n  A-->B")).toBe(true)
  })

  test("treats closed fences and trailing prose as complete", () => {
    expect(hasOpenTrailingFence("```mermaid\ngraph TD\n  A-->B\n```")).toBe(false)
    expect(hasOpenTrailingFence("```mermaid\ngraph TD\n  A-->B\n```\n\nNext paragraph")).toBe(false)
  })
})
