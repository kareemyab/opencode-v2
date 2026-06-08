/**
 * Pure, framework-free client for the Origin Edge Backend API.
 *
 * Auth: first-party desktop uses the id-orgn **access token as a Bearer JWT** plus
 * `X-Selected-Team-ID` (deno-stealth middleware/auth.ts accepts JWT/opaque tokens on
 * /api/v1). NOT an sk_ api-key. Two bases: `apiUrl` (deno-stealth Edge — /api/v1:
 * projects/tasks/trials) and `idUrl` (id-orgn — /api/user/*: teams). Cross-origin from
 * Electron must be routed through a main-process fetch (`fetchImpl`) to avoid renderer CORS.
 *
 * Response shapes vary per endpoint (matching vscode-cde's parsers):
 *   teams    → { teams: [...] }
 *   projects → [...] | { data: [...] }
 *   tasks    → [...] | { data: [...], meta: { cursor, hasMore } }
 *   trials   → [...] | { data: [...] } | { trials: [...] }
 *   object   → {...} | { data: {...} }
 */
import type {
  CloudProject,
  CloudSandboxStatus,
  CloudTask,
  CloudTaskPage,
  CloudTrial,
  CreateTrialInput,
  Team,
} from "./edge-api-types"

export type EdgeFetch = (req: {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
}) => Promise<{ ok: boolean; status: number; statusText: string; headers: Record<string, string>; body: string }>

export interface EdgeClientConfig {
  apiUrl: string // deno-stealth Edge, e.g. https://api.orgn.com
  idUrl: string // id-orgn, e.g. https://id.orgn.com
  getToken: (opts?: { force?: boolean }) => Promise<string | undefined>
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

type Json = unknown

/** Extract an array from a response: bare array, `{ <key>: [...] }`, `{ data: [...] }`, or `{ data: { <key>: [...] } }`. */
function asArray<T>(body: Json, key?: string): T[] {
  if (Array.isArray(body)) return body as T[]
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>
    if (key && Array.isArray(o[key])) return o[key] as T[]
    if (Array.isArray(o.data)) return o.data as T[]
    if (o.data && typeof o.data === "object") {
      const d = o.data as Record<string, unknown>
      if (key && Array.isArray(d[key])) return d[key] as T[]
    }
  }
  return []
}

/** Extract an object from a response: bare object or `{ data: {...} }`. */
function asObject<T>(body: Json): T {
  if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
    const d = (body as Record<string, unknown>).data
    if (d && typeof d === "object") return d as T
  }
  return body as T
}

const OLLM_KEY_TTL_MS = 5 * 60 * 1000

export function createEdgeClient(config: EdgeClientConfig) {
  const apiUrl = trimUrl(config.apiUrl)
  const idUrl = trimUrl(config.idUrl)
  const ollmKeyCache = new Map<string, { key: string; fetchedAt: number }>()

  // Returns parsed JSON on success (caller extracts the shape); throws EdgeApiError on
  // transport/HTTP/envelope failure. Retries idempotent transient errors; one forced re-auth.
  async function request(
    base: string,
    path: string,
    opts: {
      method?: string
      query?: Record<string, string | number | boolean | undefined>
      body?: unknown
      teamId?: string
    } = {},
  ): Promise<Json> {
    const url = new URL(base + path)
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
    const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined

    let force = false
    for (let attempt = 0; attempt < 4; attempt++) {
      const token = await config.getToken({ force })
      force = false
      const headers: Record<string, string> = { Accept: "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`
      if (opts.teamId) headers["X-Selected-Team-ID"] = opts.teamId
      if (bodyStr !== undefined) headers["Content-Type"] = "application/json"

      const res = await config
        .fetchImpl({ url: url.toString(), method: opts.method ?? "GET", headers, body: bodyStr })
        .catch((e: unknown) => ({
          ok: false,
          status: 0,
          statusText: e instanceof Error ? e.message : "network error",
          headers: {} as Record<string, string>,
          body: "",
        }))

      if (res.status === 0 && attempt < 3) {
        await delay(1500 * (attempt + 1))
        continue
      }
      if (res.status === 401 && attempt === 0) {
        force = true
        continue
      }
      if (!res.ok) {
        if (RETRYABLE.has(res.status) && attempt < 3) {
          await delay(1500 * (attempt + 1))
          continue
        }
        let code = String(res.status)
        let message = res.statusText || "Edge API error"
        try {
          const j = JSON.parse(res.body) as { error?: { code?: string; message?: string }; message?: string }
          if (j?.error?.code) code = j.error.code
          if (j?.error?.message) message = j.error.message
          else if (typeof j?.message === "string") message = j.message
        } catch {
          /* non-JSON error body */
        }
        throw new EdgeApiError(code, message, res.status)
      }

      const parsed: Json = res.body ? JSON.parse(res.body) : null
      // Explicit failure envelope on a 2xx.
      if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).success === false) {
        const err = (parsed as { error?: { code?: string; message?: string } }).error
        throw new EdgeApiError(err?.code ?? "error", err?.message ?? "Edge API error", res.status)
      }
      return parsed
    }
    throw new EdgeApiError("network", "Edge API request failed", 0)
  }

  return {
    request,
    teams: {
      async list(): Promise<Team[]> {
        return asArray<Team>(await request(idUrl, "/api/user/teams"), "teams")
      },
      /** Team OLLM gateway key (sk-ollm-*), via deno-stealth. Cached 5 min per team. */
      async ollmKey(teamId: string, opts?: { force?: boolean }): Promise<string> {
        const cached = ollmKeyCache.get(teamId)
        if (!opts?.force && cached && Date.now() - cached.fetchedAt < OLLM_KEY_TTL_MS) return cached.key
        const body = await request(apiUrl, `/api/v1/teams/${teamId}/ollm-key`, { teamId })
        const { apiKey } = asObject<{ apiKey?: string }>(body)
        if (typeof apiKey !== "string" || !apiKey) throw new EdgeApiError("ollm_key", "No OLLM key returned", 0)
        ollmKeyCache.set(teamId, { key: apiKey, fetchedAt: Date.now() })
        return apiKey
      },
      clearOllmKeyCache(teamId?: string) {
        if (teamId) ollmKeyCache.delete(teamId)
        else ollmKeyCache.clear()
      },
    },
    projects: {
      async list(teamId: string): Promise<CloudProject[]> {
        return asArray<CloudProject>(
          await request(apiUrl, "/api/v1/projects", { teamId, query: { teamId, archived: false, deleted: false } }),
          "projects",
        )
      },
      async get(id: string, opts: EdgeRequestOpts): Promise<CloudProject> {
        return asObject<CloudProject>(await request(apiUrl, `/api/v1/projects/${id}`, { teamId: opts.teamId }))
      },
    },
    tasks: {
      async list(
        projectId: string,
        opts: EdgeRequestOpts & { limit?: number; cursor?: string; status?: string },
      ): Promise<CloudTaskPage> {
        const body = (await request(apiUrl, "/api/v1/tasks", {
          teamId: opts.teamId,
          query: { projectId, limit: opts.limit ?? 100, cursor: opts.cursor, status: opts.status },
        })) as Record<string, unknown> | unknown[]
        const meta = (!Array.isArray(body) ? (body?.meta as { cursor?: string; hasMore?: boolean }) : undefined) ?? {}
        return {
          tasks: asArray<CloudTask>(body, "tasks"),
          cursor: meta.cursor ?? (!Array.isArray(body) ? (body?.cursor as string | undefined) : undefined),
          hasMore: meta.hasMore ?? (!Array.isArray(body) ? Boolean(body?.hasMore) : false),
        }
      },
      async trials(taskId: string, opts: EdgeRequestOpts): Promise<CloudTrial[]> {
        return asArray<CloudTrial>(await request(apiUrl, `/api/v1/tasks/${taskId}/trials`, { teamId: opts.teamId }), "trials")
      },
    },
    trials: {
      async get(id: string, opts: EdgeRequestOpts): Promise<CloudTrial> {
        return asObject<CloudTrial>(await request(apiUrl, `/api/v1/trials/${id}`, { teamId: opts.teamId }))
      },
      /**
       * Create a new worktree (Trial) under a project/task — the CDE Web "Launch CDE"
       * create step. The real `git worktree add` happens later, server-side, when the
       * sandbox is provisioned (deno-stealth clones + installs the GIT_ASKPASS shim);
       * createTrial only inserts the durable trial row, so no git credentials are needed.
       */
      async create(input: CreateTrialInput, opts: EdgeRequestOpts): Promise<CloudTrial> {
        return asObject<CloudTrial>(
          await request(apiUrl, "/api/v1/trials", { method: "POST", teamId: opts.teamId, body: input }),
        )
      },
      async sandboxStatus(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus> {
        return asObject<CloudSandboxStatus>(await request(apiUrl, `/api/v1/trials/${id}/sandbox/status`, { teamId: opts.teamId }))
      },
      async provisionSandbox(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus> {
        return asObject<CloudSandboxStatus>(
          await request(apiUrl, `/api/v1/trials/${id}/provision-sandbox`, { method: "POST", teamId: opts.teamId }),
        )
      },
      async startSandbox(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus> {
        return asObject<CloudSandboxStatus>(
          await request(apiUrl, `/api/v1/trials/${id}/sandbox/start`, { method: "POST", teamId: opts.teamId }),
        )
      },
    },
  }
}

export type EdgeClient = ReturnType<typeof createEdgeClient>
