import {
  DEEP_LINK_EVENT,
  DEEP_LINK_SCHEME,
  deepLinkPrefix,
  isAnyDeepLink,
  LEGACY_DEEP_LINK_SCHEME,
} from "@opencode-ai/ui/brand"

export {
  DEEP_LINK_EVENT,
  DEEP_LINK_SCHEME,
  deepLinkPrefix,
  isAnyDeepLink,
  isDeepLink,
  LEGACY_DEEP_LINK_EVENT,
  LEGACY_DEEP_LINK_SCHEME,
} from "@opencode-ai/ui/brand"

export const deepLinkEvent = DEEP_LINK_EVENT

export const ALLOWED_DEEP_LINK_HOSTS = ["open-project", "new-session", "open-sandbox"] as const

const allowedHosts = new Set<string>(ALLOWED_DEEP_LINK_HOSTS)

const allowedSchemes = new Set([`${DEEP_LINK_SCHEME}:`, `${LEGACY_DEEP_LINK_SCHEME}:`])

const parseUrl = (input: string) => {
  if (!isAnyDeepLink(input)) return
  if (typeof URL.canParse === "function" && !URL.canParse(input)) return
  try {
    return new URL(input)
  } catch {
    return
  }
}

export function isAllowedDeepLinkUrl(url: URL): boolean {
  if (!allowedSchemes.has(url.protocol)) return false
  if (url.username || url.password) return false
  if (url.port) return false
  if (!allowedHosts.has(url.hostname)) return false
  return true
}

export function isSafeDirectoryPath(directory: string): boolean {
  const value = directory.trim()
  if (!value) return false
  if (value.includes("\0")) return false
  if (/[\u0000-\u001F\u007F]/.test(value)) return false
  if (value.includes("://")) return false
  if (value.startsWith("//")) return false
  if (value.startsWith("/")) return true
  if (/^[A-Za-z]:[\\/]/.test(value)) return true
  if (value.startsWith("\\\\")) return true
  return false
}

function readDirectory(url: URL, key = "directory"): string | undefined {
  const directory = url.searchParams.get(key)
  if (!directory || !isSafeDirectoryPath(directory)) return
  return directory.trim()
}

const SANDBOX_ID_RE = /^[a-z0-9-]+$/i

function readSandboxId(url: URL): string | undefined {
  const sandbox = url.searchParams.get("sandbox")?.trim()
  if (!sandbox || !SANDBOX_ID_RE.test(sandbox)) return
  return sandbox
}

function readPort(url: URL): number | undefined {
  const raw = url.searchParams.get("port")?.trim()
  if (!raw || !/^\d+$/.test(raw)) return
  const port = Number(raw)
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) return
  return port
}

function readSessionId(url: URL): string | undefined {
  const id = url.searchParams.get("session")?.trim()
  if (!id || /[^A-Za-z0-9_-]/.test(id)) return
  return id
}

function readPrompt(url: URL): string | undefined {
  const prompt = url.searchParams.get("prompt")
  if (!prompt) return
  const value = prompt.trim()
  if (!value || value.includes("\0") || /[\u0000-\u001F\u007F]/.test(value)) return
  return value
}

export const parseDeepLink = (input: string) => {
  const url = parseUrl(input)
  if (!url || !isAllowedDeepLinkUrl(url)) return
  if (url.hostname !== "open-project") return
  return readDirectory(url)
}

export const parseNewSessionDeepLink = (input: string) => {
  const url = parseUrl(input)
  if (!url || !isAllowedDeepLinkUrl(url)) return
  if (url.hostname !== "new-session") return
  const directory = readDirectory(url)
  if (!directory) return
  const prompt = readPrompt(url)
  if (!prompt) return { directory }
  return { directory, prompt }
}

export type OpenSandboxDeepLink = {
  sandbox: string
  dir: string
  port?: number
  session?: string
  prompt?: string
}

/**
 * `orgn://open-sandbox?sandbox=<csbID>&dir=<absolute worktree>[&port=4096][&session=<id>][&prompt=<text>]`
 *
 * Connects the desktop app to a REMOTE running opencode instance (a Daytona
 * sandbox preview) and opens the given git worktree directory — optionally a
 * specific session, optionally seeding the composer with a prompt. Unlike
 * `open-project` / `new-session` (which open LOCAL directories on the current
 * server), this switches the active server to the sandbox's opencode origin.
 */
export const parseOpenSandboxDeepLink = (input: string): OpenSandboxDeepLink | undefined => {
  const url = parseUrl(input)
  if (!url || !isAllowedDeepLinkUrl(url)) return
  if (url.hostname !== "open-sandbox") return
  const sandbox = readSandboxId(url)
  const dir = readDirectory(url, "dir")
  if (!sandbox || !dir) return
  const port = readPort(url)
  const session = readSessionId(url)
  const prompt = readPrompt(url)
  return {
    sandbox,
    dir,
    ...(port ? { port } : {}),
    ...(session ? { session } : {}),
    ...(prompt ? { prompt } : {}),
  }
}

export const parseAuthCallbackDeepLink = (input: string) => {
  const url = parseUrl(input)
  if (!url) return
  if (url.hostname !== "auth-callback") return
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) return
  return { code, state }
}

export const collectAuthCallbackDeepLinks = (urls: string[]) =>
  urls
    .map(parseAuthCallbackDeepLink)
    .filter((link): link is { code: string; state: string } => !!link)

export const collectOpenProjectDeepLinks = (urls: string[]) =>
  urls.map(parseDeepLink).filter((directory): directory is string => !!directory)

export const collectNewSessionDeepLinks = (urls: string[]) =>
  urls.map(parseNewSessionDeepLink).filter((link): link is { directory: string; prompt?: string } => !!link)

export const collectOpenSandboxDeepLinks = (urls: string[]) =>
  urls.map(parseOpenSandboxDeepLink).filter((link): link is OpenSandboxDeepLink => !!link)

type OrgnWindow = Window & {
  __ORGN__?: {
    deepLinks?: string[]
  }
  __OPENCODE__?: {
    deepLinks?: string[]
  }
}

export const drainPendingDeepLinks = (target: OrgnWindow) => {
  const pending = target.__ORGN__?.deepLinks ?? target.__OPENCODE__?.deepLinks ?? []
  if (pending.length === 0) return []
  if (target.__ORGN__) target.__ORGN__.deepLinks = []
  if (target.__OPENCODE__) target.__OPENCODE__.deepLinks = []
  return pending
}

export const legacyDeepLinkPrefixes = [deepLinkPrefix(LEGACY_DEEP_LINK_SCHEME), deepLinkPrefix()] as const
