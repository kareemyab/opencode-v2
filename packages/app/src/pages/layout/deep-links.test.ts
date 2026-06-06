import { describe, expect, test } from "bun:test"
import {
  ALLOWED_DEEP_LINK_HOSTS,
  collectNewSessionDeepLinks,
  collectOpenProjectDeepLinks,
  drainPendingDeepLinks,
  isAllowedDeepLinkUrl,
  isSafeDirectoryPath,
  parseDeepLink,
  parseNewSessionDeepLink,
} from "./deep-links"

describe("deep link security", () => {
  test("allowlists only open-project and new-session hosts", () => {
    expect(ALLOWED_DEEP_LINK_HOSTS).toEqual(["open-project", "new-session"])
    expect(isAllowedDeepLinkUrl(new URL("orgn://open-project?directory=/tmp"))).toBe(true)
    expect(isAllowedDeepLinkUrl(new URL("opencode://new-session?directory=/tmp"))).toBe(true)
    expect(isAllowedDeepLinkUrl(new URL("orgn://evil?directory=/tmp"))).toBe(false)
    expect(isAllowedDeepLinkUrl(new URL("orgn://open-project:8080?directory=/tmp"))).toBe(false)
  })

  test("rejects embedded credentials", () => {
    expect(parseDeepLink("orgn://user:pass@open-project?directory=/tmp/demo")).toBeUndefined()
    expect(parseNewSessionDeepLink("opencode://admin:secret@new-session?directory=/tmp/demo")).toBeUndefined()
  })

  test("rejects non-file directory values", () => {
    expect(isSafeDirectoryPath("https://evil.example/path")).toBe(false)
    expect(isSafeDirectoryPath("javascript:alert(1)")).toBe(false)
    expect(isSafeDirectoryPath("//network/share")).toBe(false)
    expect(isSafeDirectoryPath("relative/path")).toBe(false)
    expect(parseDeepLink("orgn://open-project?directory=https://evil.example")).toBeUndefined()
    expect(parseDeepLink("orgn://open-project?directory=javascript:alert(1)")).toBeUndefined()
    expect(parseDeepLink("orgn://open-project?directory=relative/path")).toBeUndefined()
  })

  test("accepts absolute posix and windows directory paths", () => {
    expect(isSafeDirectoryPath("/tmp/demo")).toBe(true)
    expect(isSafeDirectoryPath("C:/Users/demo")).toBe(true)
    expect(isSafeDirectoryPath("C:\\Users\\demo")).toBe(true)
    expect(isSafeDirectoryPath("\\\\server\\share\\repo")).toBe(true)
    expect(parseDeepLink("orgn://open-project?directory=/tmp/demo")).toBe("/tmp/demo")
    expect(parseDeepLink("opencode://open-project?directory=C:%2FUsers%2Fdemo")).toBe("C:/Users/demo")
  })

  test("rejects control characters in directory and prompt", () => {
    expect(parseDeepLink("orgn://open-project?directory=%00/tmp")).toBeUndefined()
    expect(parseNewSessionDeepLink("orgn://new-session?directory=/tmp/demo&prompt=hello%0Aworld")).toEqual({
      directory: "/tmp/demo",
    })
    expect(parseNewSessionDeepLink("orgn://new-session?directory=/tmp/demo&prompt=%00")).toEqual({
      directory: "/tmp/demo",
    })
  })

  test("ignores malformed deep links safely", () => {
    expect(() => parseDeepLink("orgn://open-project/%E0%A4%A%")).not.toThrow()
    expect(parseDeepLink("orgn://open-project/%E0%A4%A%")).toBeUndefined()
  })

  test("parses links when URL.canParse is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(URL, "canParse")
    Object.defineProperty(URL, "canParse", { configurable: true, value: undefined })
    try {
      expect(parseDeepLink("orgn://open-project?directory=/tmp/demo")).toBe("/tmp/demo")
    } finally {
      if (original) Object.defineProperty(URL, "canParse", original)
      if (!original) Reflect.deleteProperty(URL, "canParse")
    }
  })

  test("collects only validated deep links", () => {
    expect(
      collectOpenProjectDeepLinks([
        "orgn://open-project?directory=/a",
        "orgn://evil?directory=/b",
        "orgn://open-project?directory=https://evil.example",
        "opencode://open-project?directory=/c",
      ]),
    ).toEqual(["/a", "/c"])

    expect(
      collectNewSessionDeepLinks([
        "orgn://new-session?directory=/a",
        "orgn://open-project?directory=/b",
        "orgn://new-session?directory=/c&prompt=ship%20it",
        "orgn://new-session?directory=relative",
      ]),
    ).toEqual([{ directory: "/a" }, { directory: "/c", prompt: "ship it" }])
  })

  test("drains orgn and legacy pending deep links once", () => {
    const orgnTarget = {
      __ORGN__: {
        deepLinks: ["orgn://open-project?directory=/a"],
      },
    } as unknown as Window & { __ORGN__?: { deepLinks?: string[] } }

    expect(drainPendingDeepLinks(orgnTarget)).toEqual(["orgn://open-project?directory=/a"])
    expect(drainPendingDeepLinks(orgnTarget)).toEqual([])

    const legacyTarget = {
      __OPENCODE__: {
        deepLinks: ["opencode://open-project?directory=/legacy"],
      },
    } as unknown as Window & { __OPENCODE__?: { deepLinks?: string[] } }

    expect(drainPendingDeepLinks(legacyTarget)).toEqual(["opencode://open-project?directory=/legacy"])
  })
})
