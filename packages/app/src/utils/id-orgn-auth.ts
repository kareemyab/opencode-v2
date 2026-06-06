/**
 * Browser-side id-orgn PKCE helpers for the desktop view-gate (public client, no secret).
 *
 * This is the renderer-side counterpart to packages/function/src/id-orgn-core.ts. It is a
 * VIEW-GATE: it forces an id-orgn login before the desktop app renders. The security
 * boundary is the PKCE authorization-code exchange over TLS, not anything the renderer can
 * enforce locally. (Full JWKS verification can be layered on if desktop ever talks to a
 * remote backend; today the sidecar is local and Basic-authed.)
 */

export interface DesktopAuthConfig {
  idOrgnUrl: string
  clientId: string
  redirectUri: string
}

const DEFAULT_SCOPE = "openid profile email offline_access"

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "") || raw.trim()
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...view)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function generateCodeVerifier(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

export function generateState(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(24)))
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64url(digest)
}

export function buildAuthorizeUrl(config: DesktopAuthConfig, opts: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: DEFAULT_SCOPE,
    access_type: "offline",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  })
  return `${normalizeBaseUrl(config.idOrgnUrl)}/api/auth/oauth2/authorize?${params}`
}

export interface DesktopTokenSet {
  accessToken: string
  idToken: string
  refreshToken?: string
  expiresIn: number
}

// Public PKCE client: client_id travels in the body; no Authorization header / secret.
export async function exchangeCode(
  config: DesktopAuthConfig,
  opts: { code: string; codeVerifier: string },
): Promise<DesktopTokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: config.redirectUri,
    code_verifier: opts.codeVerifier,
    client_id: config.clientId,
  })
  const res = await fetch(`${normalizeBaseUrl(config.idOrgnUrl)}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = (await res.json()) as {
    access_token: string
    id_token: string
    expires_in?: number
    refresh_token?: string
  }
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600,
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (parts[1].length % 4)) % 4)
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))))
  } catch {
    return null
  }
}

export function userFromIdToken(idToken: string): AuthUser | null {
  const payload = decodeJwtPayload(idToken)
  if (!payload || typeof payload.sub !== "string") return null
  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : null,
    image: typeof payload.image === "string" ? payload.image : null,
  }
}
