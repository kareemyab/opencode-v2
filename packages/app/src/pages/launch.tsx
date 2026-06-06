/**
 * Deep-link entry point for opening a specific Daytona sandbox.
 *
 * The Orgn app's "CDE Web" button links here:
 *   /launch?sandbox=<csbID>&dir=<absolute worktree path>[&port=4096]
 *
 * We pin the active server connection to the sandbox's opencode origin (sent to
 * the same-origin app-gate Worker as the X-OpenCode-Target-URL header, which the
 * Worker SSRF-allowlists and authorizes), then redirect into the normal session
 * route for the worktree directory. No session id ⇒ a fresh session is started.
 */
import { base64Encode } from "@opencode-ai/core/util/encode"
import { DAYTONA_OPENCODE_PORT, daytonaOpencodeOrigin } from "@opencode-ai/ui/brand"
import { Splash } from "@opencode-ai/ui/logo"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { onMount } from "solid-js"
import { useServer } from "@/context/server"

export default function LaunchRoute() {
  const [params] = useSearchParams<{ sandbox?: string; dir?: string; port?: string }>()
  const navigate = useNavigate()
  const server = useServer()

  onMount(() => {
    const sandbox = (params.sandbox ?? "").trim()
    const dir = (params.dir ?? "").trim()
    const portRaw = (params.port ?? "").trim()
    const port = /^\d+$/.test(portRaw) ? Number(portRaw) : DAYTONA_OPENCODE_PORT

    // Defensive validation; the Worker re-validates the target via its SSRF allowlist.
    const validSandbox = /^[a-z0-9-]+$/i.test(sandbox)
    const validDir = dir.startsWith("/")
    if (!validSandbox || !validDir) {
      navigate("/", { replace: true })
      return
    }

    const target = daytonaOpencodeOrigin(sandbox, port)
    // Targeted connections share the same-origin gateway url; only the header differs.
    const baseUrl = server.current?.http.url ?? `${location.origin}/__api`

    // Navigate first so this route is replaced before the active-server change
    // remounts the server-scoped subtree (ServerKey is `keyed`), then pin the
    // sandbox so the worktree session loads against it.
    navigate(`/${base64Encode(dir)}/session`, { replace: true })
    server.add({ type: "http", http: { url: baseUrl, target } })
  })

  return <Splash />
}
