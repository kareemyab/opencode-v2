export type CuratedThemeScheme = "light" | "dark"

export interface CuratedThemeEntry {
  key: string
  themeId: string
  vscodeId: string
  label: string
  forcedScheme?: CuratedThemeScheme
}

/** Matches vscode-cde PREFERRED_NON_DEFAULT_THEME_IDS order exactly. */
export const CURATED_THEME_ENTRIES: readonly CuratedThemeEntry[] = [
  { key: "2026-light", themeId: "2026", vscodeId: "Light 2026", label: "Light 2026", forcedScheme: "light" },
  { key: "2026-dark", themeId: "2026", vscodeId: "Dark 2026", label: "Dark 2026", forcedScheme: "dark" },
  { key: "orgn-cde-black", themeId: "orgn-cde-black", vscodeId: "ORGN CDE Black", label: "ORGN CDE Black", forcedScheme: "dark" },
  { key: "dark-plus", themeId: "dark-plus", vscodeId: "Dark+", label: "Dark+", forcedScheme: "dark" },
  { key: "dark-modern", themeId: "dark-modern", vscodeId: "Dark Modern", label: "Dark Modern", forcedScheme: "dark" },
  { key: "light-plus", themeId: "light-plus", vscodeId: "Light+", label: "Light+", forcedScheme: "light" },
  { key: "light-modern", themeId: "light-modern", vscodeId: "Light Modern", label: "Light Modern", forcedScheme: "light" },
  { key: "visual-studio-dark", themeId: "visual-studio-dark", vscodeId: "Visual Studio Dark", label: "Dark (Visual Studio)", forcedScheme: "dark" },
  { key: "visual-studio-light", themeId: "visual-studio-light", vscodeId: "Visual Studio Light", label: "Light (Visual Studio)", forcedScheme: "light" },
  { key: "hc-black", themeId: "hc-black", vscodeId: "Default High Contrast", label: "Dark High Contrast", forcedScheme: "dark" },
  { key: "hc-light", themeId: "hc-light", vscodeId: "Default High Contrast Light", label: "Light High Contrast", forcedScheme: "light" },
  { key: "orgn-original-black", themeId: "2026", vscodeId: "ORGN Original Black", label: "ORGN Original Black", forcedScheme: "dark" },
  { key: "flexoki-dark", themeId: "flexoki", vscodeId: "Flexoki Dark", label: "Flexoki Dark", forcedScheme: "dark" },
  { key: "flexoki-light", themeId: "flexoki", vscodeId: "Flexoki Light", label: "Flexoki Light", forcedScheme: "light" },
  { key: "penumbra-dark", themeId: "penumbra", vscodeId: "Penumbra Dark", label: "Penumbra Dark", forcedScheme: "dark" },
  { key: "penumbra-light", themeId: "penumbra", vscodeId: "Penumbra Light", label: "Penumbra Light", forcedScheme: "light" },
  { key: "kanagawa-wave", themeId: "kanagawa-wave", vscodeId: "Kanagawa Wave", label: "Kanagawa Wave", forcedScheme: "dark" },
  { key: "kanagawa-dragon", themeId: "kanagawa-dragon", vscodeId: "Kanagawa Dragon", label: "Kanagawa Dragon", forcedScheme: "dark" },
  { key: "kanagawa-lotus", themeId: "kanagawa-lotus", vscodeId: "Kanagawa Lotus", label: "Kanagawa Lotus", forcedScheme: "light" },
  { key: "poimandres", themeId: "poimandres", vscodeId: "poimandres", label: "poimandres", forcedScheme: "dark" },
  { key: "oxocarbon", themeId: "oxocarbon", vscodeId: "oxocarbon", label: "oxocarbon", forcedScheme: "dark" },
  { key: "oxocarbon-print", themeId: "oxocarbon-print", vscodeId: "oxocarbon PRINT", label: "oxocarbon PRINT", forcedScheme: "light" },
  { key: "rose-pine", themeId: "rosepine", vscodeId: "Rose Pine", label: "Rose Pine", forcedScheme: "dark" },
  { key: "rose-pine-moon", themeId: "rose-pine-moon", vscodeId: "Rose Pine Moon", label: "Rose Pine Moon", forcedScheme: "dark" },
  { key: "rose-pine-dawn", themeId: "rose-pine-dawn", vscodeId: "Rose Pine Dawn", label: "Rose Pine Dawn", forcedScheme: "light" },
  { key: "hack-the-box", themeId: "hack-the-box", vscodeId: "Hack The Box", label: "Hack The Box", forcedScheme: "dark" },
  { key: "alabaster", themeId: "alabaster", vscodeId: "Alabaster", label: "Alabaster", forcedScheme: "light" },
  { key: "selenized-black", themeId: "selenized-black", vscodeId: "Selenized Black Theme", label: "Selenized Black Theme", forcedScheme: "dark" },
  { key: "gruvbox-material", themeId: "gruvbox-material", vscodeId: "Gruvbox Material Dark", label: "Gruvbox Material Dark", forcedScheme: "dark" },
  { key: "phosphor-amber-night", themeId: "phosphor-amber-night", vscodeId: "Phosphor Amber Night", label: "Phosphor Amber Night", forcedScheme: "dark" },
  { key: "night-owl", themeId: "nightowl", vscodeId: "Night Owl", label: "Night Owl", forcedScheme: "dark" },
  { key: "vesper", themeId: "vesper", vscodeId: "Vesper", label: "Vesper", forcedScheme: "dark" },
  { key: "melange-dark", themeId: "melange", vscodeId: "Melange Dark", label: "Melange Dark", forcedScheme: "dark" },
  { key: "melange-light", themeId: "melange", vscodeId: "Melange Light", label: "Melange Light", forcedScheme: "light" },
  { key: "everforest-dark", themeId: "everforest", vscodeId: "Everforest Dark", label: "Everforest Dark", forcedScheme: "dark" },
  { key: "everforest-light", themeId: "everforest", vscodeId: "Everforest Light", label: "Everforest Light", forcedScheme: "light" },
  { key: "zenbones-dark", themeId: "zenbones", vscodeId: "Zenbones Dark", label: "Zenbones Dark", forcedScheme: "dark" },
  { key: "zenbones-light", themeId: "zenbones", vscodeId: "Zenbones Light", label: "Zenbones Light", forcedScheme: "light" },
  { key: "cyberdream", themeId: "cyberdream", vscodeId: "cyberdream", label: "cyberdream", forcedScheme: "dark" },
  { key: "synthwave-84", themeId: "synthwave84", vscodeId: "SynthWave '84", label: "SynthWave '84", forcedScheme: "dark" },
] as const

export const CURATED_THEME_DEFAULT_KEY = "flexoki-dark" as const

/** @deprecated Use CURATED_THEME_DEFAULT_KEY */
export const CURATED_THEME_DEFAULT = "flexoki" as const

export type CuratedThemeKey = (typeof CURATED_THEME_ENTRIES)[number]["key"]

export const CURATED_THEME_KEYS = CURATED_THEME_ENTRIES.map((entry) => entry.key)

const curatedByKey = new Map(CURATED_THEME_ENTRIES.map((entry) => [entry.key, entry]))

const curatedThemeIdSet = new Set(CURATED_THEME_ENTRIES.map((entry) => entry.themeId))

export const CURATED_THEME_NAMES: Record<string, string> = Object.fromEntries(
  CURATED_THEME_ENTRIES.map((entry) => [entry.key, entry.label]),
)

/** Unique theme file slugs used by curated entries, in first-appearance order. */
export const CURATED_THEME_IDS = [...new Set(CURATED_THEME_ENTRIES.map((entry) => entry.themeId))]

export function curatedEntryForKey(key: string): CuratedThemeEntry | undefined {
  return curatedByKey.get(key)
}

export function curatedEntryForThemeId(themeId: string, scheme: CuratedThemeScheme): CuratedThemeEntry | undefined {
  return CURATED_THEME_ENTRIES.find((entry) => entry.themeId === themeId && entry.forcedScheme === scheme)
}

export function isCuratedThemeKey(key: string): key is CuratedThemeKey {
  return curatedByKey.has(key)
}

export function isCuratedThemeId(themeId: string): boolean {
  return curatedThemeIdSet.has(themeId)
}

export function curatedThemeIds(allIds: string[]): string[] {
  const known = new Set(allIds)
  return CURATED_THEME_IDS.filter((id) => known.has(id))
}

export function curatedKeys(): CuratedThemeKey[] {
  return [...CURATED_THEME_KEYS]
}

export function resolveCuratedKey(
  key: string | null | undefined,
  themeId?: string | null,
  scheme?: CuratedThemeScheme | "system" | null,
): CuratedThemeKey {
  if (key && isCuratedThemeKey(key)) return key

  if (themeId === "oc-1" || themeId === "oc-2" || themeId === "orgn") return CURATED_THEME_DEFAULT_KEY

  if (themeId && isCuratedThemeId(themeId)) {
    const mode = scheme === "light" || scheme === "dark" ? scheme : "dark"
    const match = curatedEntryForThemeId(themeId, mode)
    if (match) return match.key
    const fallback = CURATED_THEME_ENTRIES.find((entry) => entry.themeId === themeId)
    if (fallback) return fallback.key
  }

  return CURATED_THEME_DEFAULT_KEY
}
