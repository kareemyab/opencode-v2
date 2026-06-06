import { describe, expect, test } from "bun:test"
import { DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME } from "@opencode-ai/ui/brand"
import {
  DEEP_LINK_SCHEMES,
  extractDeepLinkUrls,
  registerDeepLinkProtocolHandlers,
} from "./deep-link-protocol"

describe("deep link protocol registration", () => {
  test("registers orgn and legacy opencode schemes", () => {
    const registered: string[] = []
    const results = registerDeepLinkProtocolHandlers((scheme) => {
      registered.push(scheme)
      return true
    })

    expect(DEEP_LINK_SCHEMES).toEqual([DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME])
    expect(registered).toEqual([DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME])
    expect(results).toEqual([true, true])
  })

  test("extracts deep link args from argv", () => {
    expect(
      extractDeepLinkUrls([
        "--flag",
        "orgn://open-project?directory=/tmp/demo",
        "opencode://new-session?directory=/tmp/other",
        "https://orgn.com",
      ]),
    ).toEqual([
      "orgn://open-project?directory=/tmp/demo",
      "opencode://new-session?directory=/tmp/other",
    ])
  })
})
