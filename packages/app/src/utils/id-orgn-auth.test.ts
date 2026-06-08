import { describe, expect, test } from "bun:test"
import { userFromIdToken } from "./id-orgn-auth"

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function idToken(payload: Record<string, unknown>): string {
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url(payload)}.sig`
}

describe("userFromIdToken", () => {
  test("maps name + email from id_token claims", () => {
    const user = userFromIdToken(idToken({ sub: "u1", name: "Ada Lovelace", email: "ada@orgn.com" }))
    expect(user).toEqual({ id: "u1", email: "ada@orgn.com", name: "Ada Lovelace", image: null })
  })

  test("resolves avatar from picture, then image, then profile", () => {
    expect(userFromIdToken(idToken({ sub: "u", picture: "p.png", image: "i.png", profile: "pr.png" }))?.image).toBe(
      "p.png",
    )
    expect(userFromIdToken(idToken({ sub: "u", image: "i.png", profile: "pr.png" }))?.image).toBe("i.png")
    // id-orgn (Better Auth) id_token carries the avatar under `profile`.
    expect(userFromIdToken(idToken({ sub: "u", profile: "pr.png" }))?.image).toBe("pr.png")
    expect(userFromIdToken(idToken({ sub: "u" }))?.image).toBeNull()
  })

  test("returns null without a subject or for malformed tokens", () => {
    expect(userFromIdToken(idToken({ name: "no sub" }))).toBeNull()
    expect(userFromIdToken("not-a-jwt")).toBeNull()
  })
})
