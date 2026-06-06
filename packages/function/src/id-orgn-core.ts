/**
 * id-orgn OIDC core (config-injected).
 *
 * Ported from orgn's apps/agent/lib/auth/id-orgn-auth.ts, but with all process.env /
 * Node coupling removed: every entry point takes an explicit IdOrgnConfig. Pure WebCrypto
 * + jose, so it runs unchanged in a Cloudflare Worker and (the secret-free PKCE/validate
 * helpers) in a browser.
 *
 * Flow: authorize (PKCE) -> id-orgn -> callback -> exchangeCode -> validateIdToken (JWKS)
 * -> encrypted session cookie. The confidential web client passes clientSecret; the public
 * desktop PKCE client omits it (client_id travels in the token body instead).
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose"

export interface IdOrgnConfig {
  idOrgnUrl: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  scope?: string
  prompt?: string
}

export const OC_SESSION = "oc.session"
export const OC_OAUTH = "oc.oauth"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SESSION_SCHEMA_VERSION = 1
const SESSION_CLOCK_SKEW_MS = 60_000
const DEFAULT_SCOPE = "openid profile email offline_access"

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "") || raw.trim()
}

// ---------- PKCE / authorize (browser-safe, no secret) ----------

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function generateCodeVerifier(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

export function generateState(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(24)))
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...view)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64url(digest)
}

export function buildAuthorizeUrl(config: IdOrgnConfig, opts: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope ?? DEFAULT_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  })
  if (config.prompt) params.set("prompt", config.prompt)
  return `${normalizeBaseUrl(config.idOrgnUrl)}/api/auth/oauth2/authorize?${params}`
}

// ---------- Token exchange / refresh / revoke ----------

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`
}

export interface TokenSet {
  accessToken: string
  idToken: string
  expiresIn: number
  refreshToken?: string
}

function tokenEndpoint(config: IdOrgnConfig): string {
  return `${normalizeBaseUrl(config.idOrgnUrl)}/api/auth/oauth2/token`
}

function tokenAuth(config: IdOrgnConfig, body: URLSearchParams): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" }
  // Confidential client (web Worker) uses client_secret_basic; public PKCE client (desktop)
  // omits the secret and sends client_id in the body instead.
  if (config.clientSecret) headers["Authorization"] = basicAuthHeader(config.clientId, config.clientSecret)
  else body.set("client_id", config.clientId)
  return headers
}

export async function exchangeCode(
  config: IdOrgnConfig,
  opts: { code: string; codeVerifier: string },
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: config.redirectUri,
    code_verifier: opts.codeVerifier,
  })
  const res = await fetch(tokenEndpoint(config), { method: "POST", headers: tokenAuth(config, body), body })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text().catch(() => "")}`)
  const data = (await res.json()) as {
    access_token: string
    id_token: string
    expires_in?: number
    refresh_token?: string
  }
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    expiresIn: positiveExpiry(data.expires_in),
    refreshToken: data.refresh_token,
  }
}

function positiveExpiry(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 3600
}

export type RefreshAccessTokenResult =
  | { ok: true; accessToken: string; expiresIn: number; refreshToken?: string }
  | { ok: false; isInvalidGrant: boolean }

export async function refreshAccessToken(
  config: IdOrgnConfig,
  refreshToken: string,
): Promise<RefreshAccessTokenResult> {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
  const res = await fetch(tokenEndpoint(config), { method: "POST", headers: tokenAuth(config, body), body }).catch(
    () => null,
  )
  if (!res) return { ok: false, isInvalidGrant: false }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false, isInvalidGrant: /\binvalid_grant\b/i.test(text) || /\binvalid_token\b/i.test(text) }
  }
  const data = (await res.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
  } | null
  if (!data?.access_token) return { ok: false, isInvalidGrant: true }
  return {
    ok: true,
    accessToken: data.access_token,
    expiresIn: positiveExpiry(data.expires_in),
    refreshToken: data.refresh_token,
  }
}

async function revokeOne(config: IdOrgnConfig, token: string, hint: "refresh_token" | "access_token"): Promise<void> {
  const body = new URLSearchParams({ token, token_type_hint: hint })
  await fetch(`${normalizeBaseUrl(config.idOrgnUrl)}/api/auth/oauth2/revoke`, {
    method: "POST",
    headers: tokenAuth(config, body),
    body,
  }).catch(() => {})
}

export async function revokeIdOrgnOAuthTokens(
  config: IdOrgnConfig,
  session: Pick<SessionData, "accessToken" | "refreshToken"> | null | undefined,
): Promise<void> {
  if (!session) return
  if (session.refreshToken) await revokeOne(config, session.refreshToken, "refresh_token")
  if (session.accessToken) await revokeOne(config, session.accessToken, "access_token")
}

export function buildIdOrgnLogoutUrl(config: IdOrgnConfig, postLogoutRedirectUri: string): string {
  return `${normalizeBaseUrl(config.idOrgnUrl)}/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`
}

// ---------- JWT validation (browser + Worker) ----------

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function jwksFor(config: IdOrgnConfig) {
  const url = `${normalizeBaseUrl(config.idOrgnUrl)}/api/auth/jwks`
  const existing = jwksByUrl.get(url)
  if (existing) return existing
  const created = createRemoteJWKSet(new URL(url))
  jwksByUrl.set(url, created)
  return created
}

export async function validateIdToken(config: IdOrgnConfig, idToken: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(idToken, jwksFor(config), {
    issuer: normalizeBaseUrl(config.idOrgnUrl),
    audience: config.clientId,
    clockTolerance: 60,
  })
  return payload
}

export interface IdOrgnUser {
  id: string
  email: string
  name: string | null
  image: string | null
  emailVerified: boolean
  role: string
  roleGlobal: string
  status: string
  githubUsername: string | null
}

export function userFromJwtPayload(payload: JWTPayload): IdOrgnUser {
  return {
    id: payload.sub || "",
    email: (payload.email as string) || "",
    name: (payload.name as string) || null,
    image: (payload.image as string) || null,
    emailVerified: (payload.email_verified as boolean) || false,
    role: (payload.role as string) || "user",
    roleGlobal: (payload.role_global as string) || "USER",
    status: (payload.status as string) || "active",
    githubUsername: (payload.github_username as string) || null,
  }
}

// ---------- Session crypto (Worker-only; AES-GCM via WebCrypto) ----------

export interface SessionData {
  version: number
  user: IdOrgnUser
  accessToken: string
  refreshToken?: string
  expiresAt: number
  issuedAt: number
  refreshedAt: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("opencode-session"), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function encryptSession(secret: string, data: SessionData): Promise<string> {
  const key = await deriveAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data))),
  )
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv)
  combined.set(ciphertext, iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptSession(secret: string, encrypted: string): Promise<SessionData | null> {
  try {
    const key = await deriveAesKey(secret)
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
    if (combined.length <= 12) return null
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: combined.slice(0, 12) },
      key,
      combined.slice(12),
    )
    return normalizeSessionData(JSON.parse(decoder.decode(plaintext)))
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeSessionData(raw: unknown): SessionData | null {
  if (!isRecord(raw) || !isRecord(raw.user)) return null
  const accessToken = typeof raw.accessToken === "string" ? raw.accessToken.trim() : ""
  const userId = typeof raw.user.id === "string" ? raw.user.id : ""
  const userEmail = typeof raw.user.email === "string" ? raw.user.email : ""
  if (!accessToken || !userId || !userEmail) return null
  const expiresAt = Number(raw.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null
  const refreshToken =
    typeof raw.refreshToken === "string" && raw.refreshToken.trim().length > 0 ? raw.refreshToken : undefined
  if (expiresAt + SESSION_CLOCK_SKEW_MS < Date.now() && !refreshToken) return null
  const issuedAt = Number.isFinite(Number(raw.issuedAt)) && Number(raw.issuedAt) > 0 ? Number(raw.issuedAt) : Date.now()
  const refreshedAt =
    Number.isFinite(Number(raw.refreshedAt)) && Number(raw.refreshedAt) >= issuedAt ? Number(raw.refreshedAt) : issuedAt
  return {
    version: SESSION_SCHEMA_VERSION,
    user: userFromJwtPayload({
      sub: userId,
      email: userEmail,
      name: raw.user.name as string,
      image: raw.user.image as string,
      email_verified: raw.user.emailVerified as boolean,
      role: raw.user.role as string,
      role_global: raw.user.roleGlobal as string,
      status: raw.user.status as string,
      github_username: raw.user.githubUsername as string,
    }),
    accessToken,
    refreshToken,
    expiresAt,
    issuedAt,
    refreshedAt,
  }
}

// ---------- Signed value (HMAC) for the short-lived oc.oauth state cookie ----------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ])
}

export async function signValue(secret: string, value: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(value))
  return `${base64url(encoder.encode(value))}.${base64url(sig)}`
}

export async function verifySignedValue(secret: string, signed: string): Promise<string | null> {
  const dot = signed.indexOf(".")
  if (dot === -1) return null
  try {
    const value = decoder.decode(fromBase64url(signed.slice(0, dot)))
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64url(signed.slice(dot + 1)),
      encoder.encode(value),
    )
    return ok ? value : null
  } catch {
    return null
  }
}

function fromBase64url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// ---------- Cookies ----------

export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cookieHeader) return result
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    const raw = trimmed.slice(eq + 1)
    try {
      result[key] = decodeURIComponent(raw)
    } catch {
      result[key] = raw
    }
  }
  return result
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  const cookies = parseCookies(cookieHeader)
  return cookies[`__Secure-${name}`] ?? cookies[name]
}

function cookieAttrs(opts: { secure: boolean; maxAge: number; path?: string; domain?: string }): string {
  return [
    `Path=${opts.path ?? "/"}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAge}`,
    opts.secure ? "Secure" : "",
    opts.domain ? `Domain=${opts.domain}` : "",
  ]
    .filter(Boolean)
    .join("; ")
}

export function buildCookie(
  name: string,
  value: string,
  opts: { secure: boolean; maxAge: number; path?: string; domain?: string },
): string {
  const prefix = opts.secure ? "__Secure-" : ""
  return `${prefix}${name}=${value}; ${cookieAttrs(opts)}`
}

export function buildClearCookie(name: string, opts: { secure: boolean; path?: string; domain?: string }): string {
  const prefix = opts.secure ? "__Secure-" : ""
  return `${prefix}${name}=; ${cookieAttrs({ ...opts, maxAge: 0 })}`
}
