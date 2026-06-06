import { DEEP_LINK_SCHEME, isAnyDeepLink, LEGACY_DEEP_LINK_SCHEME } from "@opencode-ai/ui/brand"

export const DEEP_LINK_SCHEMES = [DEEP_LINK_SCHEME, LEGACY_DEEP_LINK_SCHEME] as const

export type ProtocolRegistrar = (scheme: string) => boolean

export function registerDeepLinkProtocolHandlers(register: ProtocolRegistrar): boolean[] {
  return DEEP_LINK_SCHEMES.map((scheme) => register(scheme))
}

export function extractDeepLinkUrls(args: readonly string[]): string[] {
  return args.filter((arg) => isAnyDeepLink(arg))
}
