import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { ServerConnection } from "@/context/server"
import { decode64 } from "@/utils/base64"

export function authTokenFromCredentials(input: { username?: string; password: string }) {
  return btoa(`${input.username ?? "opencode"}:${input.password}`)
}

export function authFromToken(token: string | null) {
  const decoded = decode64(token ?? undefined)
  if (!decoded) return
  const separator = decoded.indexOf(":")
  if (separator === -1) return
  return {
    username: decoded.slice(0, separator) || "opencode",
    password: decoded.slice(separator + 1),
  }
}

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createOpencodeClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (!server.password) return
    return {
      Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
    }
  })()

  // Same-origin server (the hosted id-orgn gateway, or the embedded prod binary): send the
  // HttpOnly oc.session cookie with every request so the Worker can authorize the proxy.
  const sameOrigin = (() => {
    if (typeof location === "undefined") return false
    try {
      return new URL(server.url, location.href).origin === location.origin
    } catch {
      return false
    }
  })()

  // Pin this client to a specific upstream (a Daytona sandbox) via the gateway's
  // X-OpenCode-Target-URL header. The same-origin Worker SSRF-allowlists the value
  // and mints the sandbox's preview token, so the browser only sends the origin.
  const target = server.target ? { "X-OpenCode-Target-URL": server.target } : undefined

  return createOpencodeClient({
    ...config,
    ...(sameOrigin ? { credentials: "include" as const } : {}),
    headers: {
      ...(config.headers instanceof Headers ? Object.fromEntries(config.headers.entries()) : config.headers),
      ...auth,
      ...target,
    },
    baseUrl: server.url,
  })
}
