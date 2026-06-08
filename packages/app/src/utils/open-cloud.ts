/**
 * Open a cloud worktree (trial) as a session: ensure its sandbox is provisioned and the
 * opencode HTTP server is answering, then pin a ServerConnection to the sandbox origin and
 * navigate into the worktree's session route — mirroring the /launch pin+navigate path
 * (pages/launch.tsx). The sandbox's opencode server is reachable directly from the desktop.
 */
import { base64Encode } from "@opencode-ai/core/util/encode"
import { DAYTONA_OPENCODE_PORT, daytonaOpencodeOrigin } from "@opencode-ai/ui/brand"
import type { ActiveTrialDescriptor, CloudSandboxStatus } from "./edge-api-types"

const DEFAULT_WORKSPACE_PATH = "/home/daytona/project"
const READY_STATUSES = new Set(["running", "active", "started"])
const POLL_INTERVAL_MS = 2000
const POLL_ATTEMPTS = 60 // ~2 min
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface OpenCloudDeps {
  status: (trialId: string) => Promise<CloudSandboxStatus>
  provision: (trialId: string) => Promise<CloudSandboxStatus>
  start: (trialId: string) => Promise<CloudSandboxStatus>
  /** Pin the active server to the sandbox opencode origin (server.add http). */
  connect: (origin: string) => void
  navigate: (path: string) => void
  setActiveTrial: (descriptor: ActiveTrialDescriptor) => void
  /** Optional main-process liveness probe (no CORS): resolves true when the origin answers. */
  probe?: (origin: string) => Promise<boolean>
  onProgress?: (message: string) => void
}

export interface OpenCloudInput {
  trialId: string
  descriptor: ActiveTrialDescriptor
  /** When true, skip client provisioning (the trial provisions itself). */
  skipProvision?: boolean
}

function sandboxOrigin(status: CloudSandboxStatus): string | undefined {
  if (status.opencodeURL && /^https?:\/\//.test(status.opencodeURL)) return status.opencodeURL.replace(/\/+$/, "")
  if (status.csbID) return daytonaOpencodeOrigin(status.csbID, DAYTONA_OPENCODE_PORT)
  return undefined
}

function isReady(status: CloudSandboxStatus): boolean {
  const running = status.sandboxStatus ? READY_STATUSES.has(status.sandboxStatus.toLowerCase()) : false
  return (status.ready === true || running) && !!sandboxOrigin(status)
}

/** Provision/poll the trial sandbox, then pin + navigate. Throws on timeout/failure. */
export async function openCloudTrial(deps: OpenCloudDeps, input: OpenCloudInput): Promise<void> {
  const { trialId, descriptor } = input
  const progress = (m: string) => deps.onProgress?.(m)

  progress("Checking sandbox…")
  let status = await deps.status(trialId).catch(() => ({}) as CloudSandboxStatus)

  if (!isReady(status) && !input.skipProvision) {
    progress("Starting sandbox…")
    // start is cheaper if the sandbox exists but is stopped; else provision.
    status = status.hasSandbox
      ? await deps.start(trialId).catch(() => status)
      : await deps.provision(trialId).catch(() => status)
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS && !isReady(status); attempt++) {
    await delay(POLL_INTERVAL_MS)
    progress(`Provisioning sandbox… (${attempt + 1})`)
    status = await deps.status(trialId).catch(() => status)
  }

  const origin = sandboxOrigin(status)
  if (!origin) throw new Error("Sandbox did not become ready in time")

  // Best-effort: wait for the opencode HTTP server to answer (main-process probe; no CORS).
  if (deps.probe) {
    for (let attempt = 0; attempt < 30; attempt++) {
      progress("Waiting for OpenCode…")
      if (await deps.probe(origin).catch(() => false)) break
      await delay(POLL_INTERVAL_MS)
    }
  }

  const workspacePath = status.workspacePath?.startsWith("/") ? status.workspacePath : DEFAULT_WORKSPACE_PATH

  deps.setActiveTrial({ ...descriptor, csbID: status.csbID ?? descriptor.csbID, workspacePath })

  // Navigate first so the route is replaced before the active-server change remounts the
  // server-scoped subtree (ServerKey is keyed), then pin the sandbox (desktop connects direct).
  deps.navigate(`/${base64Encode(workspacePath)}/session`)
  deps.connect(origin)
}
