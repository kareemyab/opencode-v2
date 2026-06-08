import { DEEP_LINK_SCHEME, DEV_DEEP_LINK_SCHEME, isAnyDeepLink, LEGACY_DEEP_LINK_SCHEME } from "@opencode-ai/ui/brand"

/** Schemes a packaged build claims as the OS default handler. */
export const DEEP_LINK_SCHEMES = [DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME] as const

/** Schemes an unpackaged dev build claims — isolated so it never hijacks an installed prod app. */
export const DEV_DEEP_LINK_SCHEMES = [DEV_DEEP_LINK_SCHEME] as const

/** Pick the scheme set to register based on whether this build is packaged. */
export function schemesToRegister(isPackaged: boolean): readonly string[] {
  return isPackaged ? DEEP_LINK_SCHEMES : DEV_DEEP_LINK_SCHEMES
}

export type ProtocolRegistrar = (scheme: string) => boolean

export function registerDeepLinkProtocolHandlers(
  register: ProtocolRegistrar,
  schemes: readonly string[] = DEEP_LINK_SCHEMES,
): boolean[] {
  return schemes.map((scheme) => register(scheme))
}

export function extractDeepLinkUrls(args: readonly string[]): string[] {
  return args.filter((arg) => isAnyDeepLink(arg))
}
