import { describe, expect, test } from "bun:test"
import { DEEP_LINK_SCHEME, DEV_DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME } from "@opencode-ai/ui/brand"
import {
  DEEP_LINK_SCHEMES,
  DEV_DEEP_LINK_SCHEMES,
  extractDeepLinkUrls,
  registerDeepLinkProtocolHandlers,
  schemesToRegister,
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

  test("picks the scheme set by packaged state", () => {
    expect(schemesToRegister(true)).toEqual([DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME])
    expect(schemesToRegister(false)).toEqual(DEV_DEEP_LINK_SCHEMES)
    expect(DEV_DEEP_LINK_SCHEMES).toEqual([DEV_DEEP_LINK_SCHEME])
  })

  test("registers only the dev scheme for an unpackaged build", () => {
    const registered: string[] = []
    registerDeepLinkProtocolHandlers((scheme) => {
      registered.push(scheme)
      return true
    }, schemesToRegister(false))
    expect(registered).toEqual([DEV_DEEP_LINK_SCHEME])
  })

  test("extracts deep link args from argv (incl. dev scheme)", () => {
    expect(
      extractDeepLinkUrls([
        "--flag",
        "orgn://open-project?directory=/tmp/demo",
        "opencode://new-session?directory=/tmp/other",
        "orgn-dev://auth-callback?code=a&state=b",
        "https://orgn.com",
      ]),
    ).toEqual([
      "orgn://open-project?directory=/tmp/demo",
      "opencode://new-session?directory=/tmp/other",
      "orgn-dev://auth-callback?code=a&state=b",
    ])
  })
})
