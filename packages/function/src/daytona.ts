/**
 * Daytona sandbox proxy helpers for the app-gate Worker.
 *
 * opencode runs inside Daytona sandboxes, exposed at
 *   https://<port>-<sandboxId>.proxy.daytona.orgn.com
 * The Daytona proxy gates requests behind Dex (OIDC) unless the preview is public.
 *
 * Two access modes (mirroring orgn's opencode-proxy + a private-preview path):
 *  - PUBLIC preview: just send X-Daytona-Skip-Preview-Warning + X-Daytona-Disable-CORS.
 *  - PRIVATE preview: additionally attach a per-sandbox preview token, minted server-side
 *    via the Daytona API with an admin key (never exposed to the browser).
 */

// SSRF allowlist: only self-hosted Daytona sandbox preview hosts. Format: <port>-<sandboxId>.
export const DAYTONA_PROXY_PATTERN = /^https:\/\/(\d+)-([a-z0-9-]+)\.proxy\.daytona\.orgn\.com$/i

export type DaytonaTarget = { origin: string; sandboxId: string; port: string }

export function parseDaytonaTarget(rawUrl: string | undefined | null): DaytonaTarget | null {
  if (!rawUrl) return null
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.username || url.password) return null // reject creds-in-URL
  const m = url.origin.match(DAYTONA_PROXY_PATTERN)
  if (!m) return null
  return { origin: url.origin, port: m[1], sandboxId: m[2] }
}

export const DAYTONA_HEADERS: Record<string, string> = {
  "X-Daytona-Disable-CORS": "true",
  "X-Daytona-Skip-Preview-Warning": "true",
}

type CachedToken = { token: string; expiresAt: number }
const tokenCache = new Map<string, CachedToken>()
const TOKEN_TTL_MS = 5 * 60_000

/**
 * Mint (and cache) a per-sandbox preview token via the Daytona API using the admin key.
 * Returns null on any failure (caller falls back to the public-preview path).
 */
export async function getPreviewToken(
  apiUrl: string,
  apiKey: string,
  sandboxId: string,
  port: string,
): Promise<string | null> {
  const key = `${sandboxId}:${port}`
  const hit = tokenCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.token

  const res = await fetch(
    `${apiUrl.replace(/\/+$/, "")}/api/sandbox/${sandboxId}/ports/${port}/preview-url`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  ).catch(() => null)
  if (!res || !res.ok) return null

  const data = (await res.json().catch(() => null)) as { token?: string } | null
  if (!data?.token) return null
  tokenCache.set(key, { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS })
  return data.token
}

/**
 * Resolve the Daytona auth headers for a target (preview token when configured + available).
 */
export async function daytonaAuthHeaders(
  env: { DAYTONA_API_URL?: string; DAYTONA_API_KEY?: string },
  target: DaytonaTarget,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...DAYTONA_HEADERS }
  if (env.DAYTONA_API_URL && env.DAYTONA_API_KEY) {
    const token = await getPreviewToken(env.DAYTONA_API_URL, env.DAYTONA_API_KEY, target.sandboxId, target.port)
    if (token) headers["x-daytona-preview-token"] = token
  }
  return headers
}
