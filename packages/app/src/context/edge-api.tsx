import { createSimpleContext } from "@opencode-ai/ui/context"
import { API_URL, ID_URL } from "@opencode-ai/ui/brand"
import { useAuth } from "./auth"
import { usePlatform } from "./platform"
import { createEdgeClient, type EdgeFetch } from "@/utils/edge-api"

/**
 * Provides the Origin Edge API client, wired to the id-orgn access token (Bearer) and a
 * CORS-free transport: the desktop main process (`platform.apiFetch`) when available, else
 * a plain-fetch adapter for web/dev.
 */
export const { use: useEdgeApi, provider: EdgeAPIProvider } = createSimpleContext({
  name: "EdgeAPI",
  init: () => {
    const auth = useAuth()
    const platform = usePlatform()

    const apiUrl = import.meta.env.VITE_ORGN_API_URL ?? API_URL
    const idUrl = import.meta.env.VITE_ID_ORGN_URL ?? ID_URL

    const fetchImpl: EdgeFetch = platform.apiFetch
      ? (req) => platform.apiFetch!(req)
      : async (req) => {
          const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
          const headers: Record<string, string> = {}
          res.headers.forEach((value, key) => {
            headers[key] = value
          })
          return { ok: res.ok, status: res.status, statusText: res.statusText, headers, body: await res.text() }
        }

    return createEdgeClient({
      apiUrl,
      idUrl,
      getToken: (opts) => auth.getAccessToken(opts),
      fetchImpl,
    })
  },
})
