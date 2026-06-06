/**
 * ORGN product branding constants.
 *
 * Single source of truth for user-visible identity in the desktop rebrand.
 * Runtime config paths stay on "opencode" in compat mode — see DECISIONS.md.
 */

export const PRODUCT_NAME = "orgn" as const

export const PRODUCT_NAME_DESKTOP = "orgn" as const

export const PRODUCT_TAGLINE = "Confidential Development Environment" as const

export const COMPANY_URL = "https://orgn.com" as const

export const DOCS_URL = "https://orgn.com/docs" as const

export const SUPPORT_URL = "https://orgn.com/support" as const

export const ID_URL = "https://id.orgn.com" as const

export const API_URL = "https://api.orgn.com" as const

export const APP_URL = "https://cde.orgn.com" as const

export const ATTESTATION_URL = "https://attest.daytona.orgn.com" as const

/**
 * Base domain for self-hosted Daytona sandbox previews. opencode runs inside a
 * sandbox and is exposed at `https://<port>-<sandboxId>.<DAYTONA_PROXY_BASE>`.
 * The app-gate Worker's DAYTONA_PROXY_PATTERN is the server-side source of truth;
 * this constant lets the SPA reconstruct the same origin from a sandbox id.
 */
export const DAYTONA_PROXY_BASE = "proxy.daytona.orgn.com" as const

/** Default port opencode listens on inside a sandbox. */
export const DAYTONA_OPENCODE_PORT = 4096 as const

/** Build the opencode origin for a Daytona sandbox preview. */
export function daytonaOpencodeOrigin(sandboxId: string, port: number = DAYTONA_OPENCODE_PORT): string {
  return `https://${port}-${sandboxId}.${DAYTONA_PROXY_BASE}`
}

/** Primary custom URL scheme for deep links. */
export const DEEP_LINK_SCHEME = "orgn" as const

/** Read-only alias during transition — remove after one release. */
export const LEGACY_DEEP_LINK_SCHEME = "opencode" as const

export const DEEP_LINK_EVENT = "orgn:deep-link" as const

export const LEGACY_DEEP_LINK_EVENT = "opencode:deep-link" as const

/** Prefix for new localStorage / electron-store keys. */
export const STORAGE_PREFIX = "orgn" as const

/** Legacy prefix — read fallback only in compat mode. */
export const LEGACY_STORAGE_PREFIX = "opencode" as const

export const THEME_ID_DEFAULT = "orgn" as const

export const THEME_STYLE_ID = "orgn-theme" as const

export const LEGACY_THEME_STYLE_ID = "oc-theme" as const

export type OrgnChannel = "dev" | "beta" | "prod"

export const APP_IDS: Record<OrgnChannel, string> = {
  dev: "com.orgn.desktop.dev",
  beta: "com.orgn.desktop.beta",
  prod: "com.orgn.desktop",
}

export const APP_NAMES: Record<OrgnChannel, string> = {
  dev: "orgn Dev",
  beta: "orgn Beta",
  prod: "orgn",
}

export const ARTIFACT_NAME = "orgn-desktop-${os}-${arch}.${ext}" as const

export const RPM_PACKAGE_NAME = "orgn-desktop" as const

/** Default electron-updater generic feed base URLs (override with ORGN_UPDATE_URL at build/runtime). */
export const UPDATE_PUBLISH_URLS: Record<Exclude<OrgnChannel, "dev">, string> = {
  beta: "https://origin-agent.sfo3.digitaloceanspaces.com/orgn-desktop-beta",
  prod: "https://origin-agent.sfo3.digitaloceanspaces.com/orgn-desktop",
}

export function updatePublishUrl(channel: OrgnChannel): string | undefined {
  if (channel === "dev") return undefined
  const env = process.env.ORGN_UPDATE_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  return UPDATE_PUBLISH_URLS[channel]
}

/** CSS / design tokens for orgn default theme (dark). */
export const ORGN_THEME_COLORS = {
  surfaceVoid: "#000000",
  surfaceRaised: "#141414",
  border: "#1F1F1F",
  textPrimary: "#FFFFFF",
  textSecondary: "#CCCCCC",
  spectralTeal: "#2FFFD7",
  electricViolet: "#7A5CFF",
  diffractionBlue: "#4FA8FF",
  error: "#ff3333",
  metaThemeColorDark: "#000000",
  metaThemeColorLight: "#fafafa",
} as const

/** Zero radius tokens — orgn sharp-corner brand rule. Injected when the orgn theme is active. */
export const ORGN_RADIUS_CSS = `
  --radius-xs: 0;
  --radius-sm: 0;
  --radius-md: 0;
  --radius-lg: 0;
  --radius-xl: 0;
` as const

export function storageKey(suffix: string): string {
  return `${STORAGE_PREFIX}.${suffix}`
}

export function legacyStorageKey(suffix: string): string {
  return `${LEGACY_STORAGE_PREFIX}.${suffix}`
}

export function themeStorageKey(name: string): string {
  return `${STORAGE_PREFIX}-${name}`
}

export function legacyThemeStorageKey(name: string): string {
  return `${LEGACY_STORAGE_PREFIX}-${name}`
}

export const THEME_STORAGE = {
  themeId: themeStorageKey("theme-id"),
  colorScheme: themeStorageKey("color-scheme"),
  themeCssLight: themeStorageKey("theme-css-light"),
  themeCssDark: themeStorageKey("theme-css-dark"),
} as const

export const LEGACY_THEME_STORAGE = {
  themeId: legacyThemeStorageKey("theme-id"),
  colorScheme: legacyThemeStorageKey("color-scheme"),
  themeCssLight: legacyThemeStorageKey("theme-css-light"),
  themeCssDark: legacyThemeStorageKey("theme-css-dark"),
} as const

export const DESKTOP_STORAGE = {
  settings: storageKey("settings"),
  globalDat: storageKey("global.dat"),
} as const

export const LEGACY_DESKTOP_STORAGE = {
  settings: legacyStorageKey("settings"),
  globalDat: legacyStorageKey("global.dat"),
} as const

export function deepLinkPrefix(scheme: string = DEEP_LINK_SCHEME): string {
  return `${scheme}://`
}

export function isDeepLink(url: string, scheme: string = DEEP_LINK_SCHEME): boolean {
  return url.startsWith(deepLinkPrefix(scheme))
}

export function isAnyDeepLink(url: string): boolean {
  return isDeepLink(url, DEEP_LINK_SCHEME) || isDeepLink(url, LEGACY_DEEP_LINK_SCHEME)
}

export function productNameForChannel(channel: OrgnChannel): string {
  return APP_NAMES[channel]
}

export function appIdForChannel(channel: OrgnChannel): string {
  return APP_IDS[channel]
}
