/**
 * Pure, framework-free client for the Origin Edge Backend API.
 *
 * Auth: first-party desktop uses the id-orgn **access token as a Bearer JWT** plus
 * `X-Selected-Team-ID` (deno-stealth middleware/auth.ts accepts JWT/opaque tokens on
 * /api/v1). NOT an sk_ api-key. Two bases: `apiUrl` (/api/v1: projects/tasks/trials) and
 * `idUrl` (/api/user/*: teams). Cross-origin from Electron must be routed through a
 * main-process fetch (`fetchImpl`) to avoid renderer CORS.
 */
import type { CloudProject, CloudSandboxStatus, CloudTask, CloudTaskPage, CloudTrial, Team } from "./edge-api-types"

export type EdgeFetch = (req: {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
}) => Promise<{ ok: boolean; status: number; statusText: string; headers: Record<string, string>; body: string }>

export interface EdgeClientConfig {
  apiUrl: string // e.g. https://api.orgn.com
  idUrl: string // e.g. https://id.orgn.com
  getToken: () => Promise<string | undefined>
  fetchImpl: EdgeFetch
}

export interface EdgeRequestOpts {
  teamId?: string
}

export class EdgeApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "EdgeApiError"
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const trimUrl = (raw: string) => raw.trim().replace(/\/+$/, "")

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "success" in (raw as Record<string, unknown>)) {
    const env = raw as { success: boolean; data?: unknown; error?: { code?: string; message?: string } }
    if (env.success) return env.data as T
    throw new EdgeApiError(env.error?.code ?? "error", env.error?.message ?? "Edge API error", 200)
  }
  return raw as T // bare payload (some endpoints return arrays directly)
}

export function createEdgeClient(config: EdgeClientConfig) {
  const apiUrl = trimUrl(config.apiUrl)
  const idUrl = trimUrl(config.idUrl)

  async function request<T>(
    base: string,
    path: string,
    opts: {
      method?: string
      query?: Record<string, string | number | boolean | undefined>
      body?: unknown
      teamId?: string
    } = {},
  ): Promise<T> {
    const url = new URL(base + path)
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
    const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined

    for (let attempt = 0; attempt < 4; attempt++) {
      const token = await config.getToken()
      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      if (opts.teamId) headers["X-Selected-Team-ID"] = opts.teamId
      if (bodyStr !== undefined) headers["Content-Type"] = "application/json"

      const res = await config.fetchImpl({
        url: url.toString(),
        method: opts.method ?? "GET",
        headers,
        body: bodyStr,
      })

      // One reactive re-auth attempt (getToken may refresh a near-expiry token).
      if (res.status === 401 && attempt === 0) continue
      if (!res.ok) {
        if (RETRYABLE.has(res.status) && attempt < 3) {
          await delay(1500 * (attempt + 1))
          continue
        }
        let code = String(res.status)
        let message = res.statusText || "Edge API error"
        try {
          const j = JSON.parse(res.body) as { error?: { code?: string; message?: string } }
          if (j?.error?.code) code = j.error.code
          if (j?.error?.message) message = j.error.message
        } catch {
          /* non-JSON error body */
        }
        throw new EdgeApiError(code, message, res.status)
      }
      return unwrap<T>(res.body ? JSON.parse(res.body) : null)
    }
    throw new EdgeApiError("network", "Edge API request failed", 0)
  }

  return {
    request,
    teams: {
      list(): Promise<Team[]> {
        // id-orgn base, no team header.
        return request<Team[]>(idUrl, "/api/user/teams")
      },
    },
    projects: {
      list(teamId: string): Promise<CloudProject[]> {
        return request<CloudProject[]>(apiUrl, "/api/v1/projects", {
          teamId,
          query: { teamId, archived: false, deleted: false },
        })
      },
      get(id: string, opts: EdgeRequestOpts): Promise<CloudProject> {
        return request<CloudProject>(apiUrl, `/api/v1/projects/${id}`, { teamId: opts.teamId })
      },
    },
    tasks: {
      list(
        projectId: string,
        opts: EdgeRequestOpts & { limit?: number; cursor?: string; status?: string },
      ): Promise<CloudTaskPage> {
        return request<CloudTaskPage>(apiUrl, "/api/v1/tasks", {
          teamId: opts.teamId,
          query: { projectId, limit: opts.limit ?? 100, cursor: opts.cursor, status: opts.status },
        })
      },
      trials(taskId: string, opts: EdgeRequestOpts): Promise<CloudTrial[]> {
        return request<CloudTrial[]>(apiUrl, `/api/v1/tasks/${taskId}/trials`, { teamId: opts.teamId })
      },
    },
    trials: {
      get(id: string, opts: EdgeRequestOpts): Promise<CloudTrial> {
        return request<CloudTrial>(apiUrl, `/api/v1/trials/${id}`, { teamId: opts.teamId })
      },
      sandboxStatus(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus> {
        return request<CloudSandboxStatus>(apiUrl, `/api/v1/trials/${id}/sandbox/status`, { teamId: opts.teamId })
      },
      provisionSandbox(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus> {
        return request<CloudSandboxStatus>(apiUrl, `/api/v1/trials/${id}/provision-sandbox`, {
          method: "POST",
          teamId: opts.teamId,
        })
      },
      startSandbox(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus> {
        return request<CloudSandboxStatus>(apiUrl, `/api/v1/trials/${id}/sandbox/start`, {
          method: "POST",
          teamId: opts.teamId,
        })
      },
    },
  }
}

export type EdgeClient = ReturnType<typeof createEdgeClient>
