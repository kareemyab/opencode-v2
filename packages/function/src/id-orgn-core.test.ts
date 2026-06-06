import { describe, expect, test } from "bun:test"
import {
  buildAuthorizeUrl,
  decryptSession,
  encryptSession,
  generateCodeChallenge,
  generateCodeVerifier,
  signValue,
  verifySignedValue,
  type SessionData,
} from "./id-orgn-core"

const session: SessionData = {
  version: 1,
  user: {
    id: "user_1",
    email: "a@b.com",
    name: "A",
    image: null,
    emailVerified: true,
    role: "user",
    roleGlobal: "USER",
    status: "active",
    githubUsername: null,
  },
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.now() + 100_000,
  issuedAt: Date.now(),
  refreshedAt: Date.now(),
}

describe("id-orgn-core", () => {
  test("session encrypt/decrypt round-trips and rejects a wrong secret", async () => {
    const enc = await encryptSession("secret-a", session)
    const dec = await decryptSession("secret-a", enc)
    expect(dec?.user.id).toBe("user_1")
    expect(dec?.accessToken).toBe("access-token")
    expect(dec?.refreshToken).toBe("refresh-token")
    expect(await decryptSession("secret-b", enc)).toBeNull()
    expect(await decryptSession("secret-a", "garbage")).toBeNull()
  })

  test("signed value round-trips and rejects tamper / wrong key", async () => {
    const payload = JSON.stringify({ state: "x", codeVerifier: "y" })
    const signed = await signValue("k", payload)
    expect(await verifySignedValue("k", signed)).toBe(payload)
    expect(await verifySignedValue("other", signed)).toBeNull()
    expect(await verifySignedValue("k", `${signed}tampered`)).toBeNull()
  })

  test("PKCE challenge is base64url (S256)", async () => {
    const challenge = await generateCodeChallenge(generateCodeVerifier())
    expect(challenge).not.toMatch(/[+/=]/)
    expect(challenge.length).toBeGreaterThan(20)
  })

  test("authorize URL carries PKCE + client params", () => {
    const url = buildAuthorizeUrl(
      { idOrgnUrl: "https://id.example.com/", clientId: "cid", redirectUri: "https://app.example.com/api/auth/callback" },
      { state: "st", codeChallenge: "ch" },
    )
    expect(url).toContain("https://id.example.com/api/auth/oauth2/authorize")
    expect(url).toContain("code_challenge=ch")
    expect(url).toContain("code_challenge_method=S256")
    expect(url).toContain("client_id=cid")
    expect(url).toContain("scope=openid+profile+email+offline_access")
  })
})
