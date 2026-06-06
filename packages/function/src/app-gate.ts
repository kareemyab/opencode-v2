/**
 * opencode web app gate (Cloudflare Worker).
 *
 * Fronts the opencode SPA on app.<domain>. Two jobs, mirroring orgn's
 * opencode-proxy precedent:
 *   1. Gate the SPA shell behind an id-orgn session cookie (OIDC + PKCE dance).
 *   2. Same-origin proxy the data plane (/__api/* — REST, SSE, and the PTY WS) to a
 *      network-isolated opencode backend, authorizing with the id-orgn session and
 *      stripping any client-supplied credentials before forwarding.
 *
 * The opencode backend stays unauthenticated behind network isolation; the Worker is
 * the only authed boundary. Gating is active only in the prod channel.
 */

import { Hono } from "hono"
import {
  OC_SESSION,
  OC_OAUTH,
  SESSION_MAX_AGE,
  buildAuthorizeUrl,
  buildClearCookie,
  buildCookie,
  buildIdOrgnLogoutUrl,
  decryptSession,
  encryptSession,
  exchangeCode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  readCookie,
  refreshAccessToken,
  revokeIdOrgnOAuthTokens,
  signValue,
  userFromJwtPayload,
  validateIdToken,
  verifySignedValue,
  type IdOrgnConfig,
  type SessionData,
} from "./id-orgn-core"

type Env = {
  ASSETS: Fetcher
  APP_URL: string
  ID_ORGN_URL: string
  ID_ORGN_CLIENT_ID: string
  ID_ORGN_CLIENT_SECRET: string
  SESSION_SECRET: string
  OPENCODE_CHANNEL: string
  OPENCODE_BACKEND_URL: string
}

const PROXY_PREFIX = "/__api"
const REFRESH_WINDOW_MS = 60_000
const OAUTH_MAX_AGE = 600

// Headers we forward to the backend. Client Authorization/Cookie and ?auth_token are
// deliberately NOT forwarded — the backend must never see client-supplied credentials.
const FORWARD_HEADERS = [
  "content-type",
  "accept",
  "x-opencode-directory",
  "x-opencode-workspace",
  "x-opencode-ticket",
  "range",
  "if-none-match",
  "user-agent",
]

function config(env: Env): IdOrgnConfig {
  return {
    idOrgnUrl: env.ID_ORGN_URL,
    clientId: env.ID_ORGN_CLIENT_ID,
    clientSecret: env.ID_ORGN_CLIENT_SECRET,
    redirectUri: `${env.APP_URL.replace(/\/+$/, "")}/api/auth/callback`,
  }
}

const isGated = (env: Env) => env.OPENCODE_CHANNEL === "prod"
const isSecure = (env: Env) => env.APP_URL.startsWith("https")

// Only allow same-origin path redirects; never an absolute/protocol-relative URL.
function sanitizeReturnTo(value: string | undefined | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

type Resolved = { session: SessionData | null; setCookie?: string }

// Decrypt the session cookie and, when the access token is near expiry, refresh it
// (the Worker is the SINGLE refresher for hosted sessions) and re-seal the cookie.
async function resolveSession(c: { req: { header: (n: string) => string | undefined }; env: Env }): Promise<Resolved> {
  const encrypted = readCookie(c.req.header("cookie"), OC_SESSION)
  if (!encrypted) return { session: null }
  const session = await decryptSession(c.env.SESSION_SECRET, encrypted)
  if (!session) return { session: null }

  if (session.expiresAt - Date.now() > REFRESH_WINDOW_MS || !session.refreshToken) return { session }

  const refreshed = await refreshAccessToken(config(c.env), session.refreshToken)
  if (!refreshed.ok) {
    if (refreshed.isInvalidGrant) return { session: null, setCookie: clearSessionCookie(c.env) }
    return { session } // transient failure: keep using the current (still-valid-ish) session
  }
  const next: SessionData = {
    ...session,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? session.refreshToken,
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
    refreshedAt: Date.now(),
  }
  return { session: next, setCookie: await sessionCookie(c.env, next) }
}

async function sessionCookie(env: Env, session: SessionData): Promise<string> {
  return buildCookie(OC_SESSION, await encryptSession(env.SESSION_SECRET, session), {
    secure: isSecure(env),
    maxAge: SESSION_MAX_AGE,
  })
}

function clearSessionCookie(env: Env): string {
  return buildClearCookie(OC_SESSION, { secure: isSecure(env) })
}

const app = new Hono<{ Bindings: Env }>()

// ---------- Auth control plane (never gated — this IS the login flow) ----------

app.get("/api/auth/signin", async (c) => {
  const returnTo = sanitizeReturnTo(c.req.query("returnTo"))
  if (!isGated(c.env)) return c.redirect(returnTo)

  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const signed = await signValue(c.env.SESSION_SECRET, JSON.stringify({ state, codeVerifier, returnTo }))

  c.header(
    "Set-Cookie",
    buildCookie(OC_OAUTH, signed, { secure: isSecure(c.env), maxAge: OAUTH_MAX_AGE, path: "/api/auth" }),
  )
  return c.redirect(buildAuthorizeUrl(config(c.env), { state, codeChallenge }))
})

app.get("/api/auth/callback", async (c) => {
  const code = c.req.query("code")
  const state = c.req.query("state")
  const fail = (reason: string) => c.redirect(`/api/auth/signin?error=${reason}`)
  if (!code || !state) return fail("missing_code")

  const oauthCookie = readCookie(c.req.header("cookie"), OC_OAUTH)
  if (!oauthCookie) return fail("please_restart")
  const verified = await verifySignedValue(c.env.SESSION_SECRET, oauthCookie)
  if (!verified) return fail("invalid_state")
  const oauth = JSON.parse(verified) as { state: string; codeVerifier: string; returnTo: string }
  if (oauth.state !== state) return fail("state_mismatch")

  const tokens = await exchangeCode(config(c.env), { code, codeVerifier: oauth.codeVerifier }).catch(() => null)
  if (!tokens) return fail("token_exchange_failed")

  const payload = await validateIdToken(config(c.env), tokens.idToken).catch(() => null)
  if (!payload) return fail("invalid_id_token")

  const now = Date.now()
  const session: SessionData = {
    version: 1,
    user: userFromJwtPayload(payload),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: now + tokens.expiresIn * 1000,
    issuedAt: now,
    refreshedAt: now,
  }
  c.header("Set-Cookie", await sessionCookie(c.env, session))
  c.header("Set-Cookie", buildClearCookie(OC_OAUTH, { secure: isSecure(c.env), path: "/api/auth" }), { append: true })
  return c.redirect(sanitizeReturnTo(oauth.returnTo))
})

app.get("/api/auth/session", async (c) => {
  if (!isGated(c.env)) return c.json({ authenticated: true, user: null })
  const { session, setCookie } = await resolveSession(c)
  if (setCookie) c.header("Set-Cookie", setCookie)
  if (!session) return c.json({ authenticated: false, user: null })
  return c.json({ authenticated: true, user: session.user })
})

app.post("/api/auth/logout", async (c) => {
  const encrypted = readCookie(c.req.header("cookie"), OC_SESSION)
  const session = encrypted ? await decryptSession(c.env.SESSION_SECRET, encrypted) : null
  if (session) await revokeIdOrgnOAuthTokens(config(c.env), session)
  c.header("Set-Cookie", clearSessionCookie(c.env))
  return c.json({ url: buildIdOrgnLogoutUrl(config(c.env), `${c.env.APP_URL.replace(/\/+$/, "")}/api/auth/signin`) })
})

// ---------- Data-plane proxy (/__api/* -> isolated backend; REST, SSE, WS) ----------

app.all(`${PROXY_PREFIX}/*`, async (c) => {
  let setCookie: string | undefined
  if (isGated(c.env)) {
    const resolved = await resolveSession(c)
    if (!resolved.session) {
      const headers = resolved.setCookie ? { "Set-Cookie": resolved.setCookie } : undefined
      return c.json({ error: "unauthorized" }, 401, headers)
    }
    setCookie = resolved.setCookie
  }

  const backend = c.env.OPENCODE_BACKEND_URL
  if (!backend) return c.json({ error: "backend_not_configured" }, 502)

  const incoming = new URL(c.req.url)
  const target = new URL(backend)
  target.pathname = `${target.pathname.replace(/\/$/, "")}${incoming.pathname.slice(PROXY_PREFIX.length) || "/"}`
  for (const [k, v] of incoming.searchParams) {
    if (k === "auth_token") continue // never forward a client-supplied token to the backend
    target.searchParams.append(k, v)
  }

  // WebSocket upgrade (PTY): forward the raw request so Cloudflare preserves the upgrade.
  if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
    return fetch(target.toString(), c.req.raw as unknown as RequestInit)
  }

  const fwd = new Headers()
  for (const h of FORWARD_HEADERS) {
    const v = c.req.header(h)
    if (v) fwd.set(h, v)
  }
  const method = c.req.method
  const hasBody = method !== "GET" && method !== "HEAD"
  const upstream = await fetch(target.toString(), {
    method,
    headers: fwd,
    body: hasBody ? c.req.raw.body : undefined,
    redirect: "manual",
    // @ts-expect-error - duplex is required when streaming a request body (runtime supports it)
    duplex: hasBody ? "half" : undefined,
  })

  const respHeaders = new Headers(upstream.headers)
  respHeaders.delete("set-cookie") // backend must not set cookies through the gate
  if (setCookie) respHeaders.append("set-cookie", setCookie)
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders })
})

// ---------- Shell (static assets), gated ----------

app.all("*", async (c) => {
  if (isGated(c.env)) {
    const { session, setCookie } = await resolveSession(c)
    if (!session) {
      const returnTo = new URL(c.req.url).pathname
      return c.redirect(`/api/auth/signin?returnTo=${encodeURIComponent(returnTo)}`)
    }
    const res = await c.env.ASSETS.fetch(c.req.raw)
    if (!setCookie) return res
    const headers = new Headers(res.headers)
    headers.append("set-cookie", setCookie)
    return new Response(res.body, { status: res.status, headers })
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
