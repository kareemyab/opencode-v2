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

export const ALLOWED_DEEP_LINK_HOSTS = ["open-project", "new-session"] as const

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

function readDirectory(url: URL): string | undefined {
  const directory = url.searchParams.get("directory")
  if (!directory || !isSafeDirectoryPath(directory)) return
  return directory.trim()
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

export const collectOpenProjectDeepLinks = (urls: string[]) =>
  urls.map(parseDeepLink).filter((directory): directory is string => !!directory)

export const collectNewSessionDeepLinks = (urls: string[]) =>
  urls.map(parseNewSessionDeepLink).filter((link): link is { directory: string; prompt?: string } => !!link)

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
