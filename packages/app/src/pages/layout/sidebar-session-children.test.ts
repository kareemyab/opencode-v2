import { describe, expect, test } from "bun:test"
import {
  sessionChildrenExpanded,
  sessionChildrenKey,
  setSessionChildrenExpanded,
} from "./sidebar-session-children"

describe("sidebar-session-children", () => {
  test("tracks expanded state per session key", () => {
    const key = sessionChildrenKey("/workspace", "session-1")

    expect(sessionChildrenExpanded(key)).toBeUndefined()
    setSessionChildrenExpanded(key, false)
    expect(sessionChildrenExpanded(key)).toBe(false)
    setSessionChildrenExpanded(key, true)
    expect(sessionChildrenExpanded(key)).toBe(true)
  })
})
