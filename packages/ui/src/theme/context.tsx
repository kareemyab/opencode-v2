// @refresh reload

import { createEffect, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import {
  LEGACY_THEME_STORAGE,
  ORGN_RADIUS_CSS,
  ORGN_THEME_COLORS,
  THEME_CACHE_VERSION,
  THEME_ID_DEFAULT,
  THEME_STORAGE,
  THEME_STYLE_ID,
} from "../brand"
import { createSimpleContext } from "../context/helper"
import orgnThemeJson from "./themes/orgn.json"
import {
  CURATED_THEME_ENTRIES,
  curatedEntryForKey,
  curatedEntryForThemeId,
  curatedKeys,
  curatedThemeIds,
  isCuratedThemeId,
  isCuratedThemeKey,
  resolveCuratedKey,
  type CuratedThemeEntry,
  type CuratedThemeKey,
} from "./curated-themes"
import { resolveThemeVariant, themeToCss } from "./resolve"
import { resolveThemeVariantV2, themeV2ToCss } from "./v2/resolve"
import { resolveTerminalTheme, terminalThemeCss } from "./terminal-theme"
import type { DesktopTheme, ThemeVariant } from "./types"

export type ColorScheme = "light" | "dark" | "system"

const STORAGE_KEYS = THEME_STORAGE
const LEGACY_KEYS = LEGACY_THEME_STORAGE
const INLINE_THEME_ID = "orgn"
const DEFAULT_THEME_ID = THEME_ID_DEFAULT
const HIDDEN_THEME_IDS = new Set(["opencode", "oc-2"])

const COMPOSER_SURFACE_CSS = `
[data-dock-surface="shell"],
[data-dock-surface="tray"],
[data-component="session-prompt-dock"] {
  background-color: var(--background-base);
}

[data-color-scheme="dark"] [data-dock-surface="shell"],
[data-color-scheme="dark"] [data-dock-surface="tray"],
[data-color-scheme="dark"] [data-component="session-prompt-dock"] {
  background-color: var(--background-base);
  border-color: var(--border-weak-base, var(--border));
}
`

let files: Record<string, () => Promise<{ default: DesktopTheme }>> | undefined
let ids: string[] | undefined
let known: Set<string> | undefined

function getFiles() {
  if (files) return files
  files = import.meta.glob<{ default: DesktopTheme }>("./themes/*.json")
  return files
}

function themeIDs() {
  if (ids) return ids
  ids = Object.keys(getFiles())
    .map((path) => path.slice("./themes/".length, -".json".length))
    .sort()
  return ids
}

function knownThemes() {
  if (known) return known
  known = new Set(themeIDs())
  return known
}

const orgnTheme = orgnThemeJson as DesktopTheme

function isInlineTheme(id: string) {
  return id === INLINE_THEME_ID
}

function resolveThemeSlug(id: string | null | undefined): string {
  if (id === "oc-1" || id === "oc-2") return DEFAULT_THEME_ID
  if (id && knownThemes().has(id) && isCuratedThemeId(id)) return id
  if (id && knownThemes().has(id)) return DEFAULT_THEME_ID
  return DEFAULT_THEME_ID
}

function schemeFromStorage(raw: string | null): ColorScheme {
  if (raw === "light" || raw === "dark" || raw === "system") return raw
  return "dark"
}

function modeFromScheme(scheme: ColorScheme): "light" | "dark" {
  if (scheme === "system") return getSystemMode()
  return scheme
}

function read(key: string) {
  if (typeof localStorage !== "object") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readWithLegacy(primary: string, legacy: string) {
  return read(primary) ?? read(legacy)
}

function write(key: string, value: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function drop(key: string) {
  if (typeof localStorage !== "object") return
  try {
    localStorage.removeItem(key)
  } catch {}
}

function clearThemeCache() {
  drop(STORAGE_KEYS.themeCssLight)
  drop(STORAGE_KEYS.themeCssDark)
  drop(LEGACY_KEYS.themeCssLight)
  drop(LEGACY_KEYS.themeCssDark)
}

function ensureCacheVersion() {
  const current = read(STORAGE_KEYS.cacheVersion)
  if (current === THEME_CACHE_VERSION) return
  write(STORAGE_KEYS.cacheVersion, THEME_CACHE_VERSION)
  clearThemeCache()
}

function ensureThemeStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (existing) return existing
  const element = document.createElement("style")
  element.id = THEME_STYLE_ID
  document.head.appendChild(element)
  return element
}

function getSystemMode(): "light" | "dark" {
  if (typeof window !== "object") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyThemeCss(theme: DesktopTheme, themeId: string, mode: "light" | "dark") {
  const isDark = mode === "dark"
  const variant = isDark ? theme.dark : theme.light
  const tokens = resolveThemeVariant(variant, isDark)
  const css = themeToCss(tokens)
  const v2 = themeV2ToCss(resolveThemeVariantV2(variant, isDark))

  const terminalCss = terminalThemeCss(variant, tokens)

  if (!isInlineTheme(themeId)) {
    write(
      isDark ? STORAGE_KEYS.themeCssDark : STORAGE_KEYS.themeCssLight,
      `${css}\n  ${v2}\n  ${terminalCss}\n${COMPOSER_SURFACE_CSS}`,
    )
  }

  const fullCss = `:root {
  color-scheme: ${mode};
  --text-mix-blend-mode: ${isDark ? "plus-lighter" : "multiply"};
  ${ORGN_RADIUS_CSS}
  ${css}
  ${v2}
  ${terminalCss}
}
${COMPOSER_SURFACE_CSS}`

  document.getElementById("oc-theme-preload")?.remove()
  ensureThemeStyleElement().textContent = fullCss
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute(
      "content",
      isDark ? ORGN_THEME_COLORS.metaThemeColorDark : ORGN_THEME_COLORS.metaThemeColorLight,
    )
  }
}

function cacheThemeVariants(theme: DesktopTheme, themeId: string) {
  if (isInlineTheme(themeId)) return
  for (const mode of ["light", "dark"] as const) {
    const isDark = mode === "dark"
    const variant = isDark ? theme.dark : theme.light
    const tokens = resolveThemeVariant(variant, isDark)
    const css = themeToCss(tokens)
    const v2 = themeV2ToCss(resolveThemeVariantV2(variant, isDark))
    const terminalCss = terminalThemeCss(variant, tokens)
    write(
      isDark ? STORAGE_KEYS.themeCssDark : STORAGE_KEYS.themeCssLight,
      `${css}\n  ${v2}\n  ${terminalCss}\n${COMPOSER_SURFACE_CSS}`,
    )
  }
}

function entryMode(entry: CuratedThemeEntry): "light" | "dark" {
  if (entry.forcedScheme) return entry.forcedScheme
  return "dark"
}

function curatedEntryForResolvedMode(themeId: string, scheme: ColorScheme): CuratedThemeEntry | undefined {
  return curatedEntryForThemeId(themeId, modeFromScheme(scheme))
}

function paletteColorScheme(entry: CuratedThemeEntry): ColorScheme {
  return entry.forcedScheme ?? "dark"
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { defaultTheme?: string; onThemeApplied?: (theme: DesktopTheme, mode: "light" | "dark") => void }) => {
    ensureCacheVersion()

    const rawThemeId = readWithLegacy(STORAGE_KEYS.themeId, LEGACY_KEYS.themeId) ?? props.defaultTheme
    const rawCuratedKey = read(STORAGE_KEYS.curatedKey)
    const rawScheme = readWithLegacy(STORAGE_KEYS.colorScheme, LEGACY_KEYS.colorScheme)
    const savedScheme = schemeFromStorage(rawScheme)
    const savedThemeId = resolveThemeSlug(rawThemeId)
    const savedCuratedKey = resolveCuratedKey(rawCuratedKey, savedThemeId, savedScheme)
    const savedEntry = curatedEntryForKey(savedCuratedKey)!
    const savedColorScheme = savedScheme
    const savedMode = modeFromScheme(savedColorScheme)

    const [store, setStore] = createStore({
      themes: {
        [INLINE_THEME_ID]: orgnTheme,
      } as Record<string, DesktopTheme>,
      themeId: savedEntry.themeId,
      curatedKey: savedCuratedKey as CuratedThemeKey,
      colorScheme: savedColorScheme as ColorScheme,
      mode: savedMode,
      previewCuratedKey: null as CuratedThemeKey | null,
      previewScheme: null as ColorScheme | null,
    })

    const loads = new Map<string, Promise<DesktopTheme | undefined>>()

    const load = (id: string) => {
      const next = resolveThemeSlug(id)
      const hit = store.themes[next]
      if (hit) return Promise.resolve(hit)
      const pending = loads.get(next)
      if (pending) return pending
      const file = getFiles()[`./themes/${next}.json`]
      if (!file) return Promise.resolve(undefined)
      const task = file()
        .then((mod) => {
          const theme = mod.default
          setStore("themes", next, theme)
          return theme
        })
        .finally(() => {
          loads.delete(next)
        })
      loads.set(next, task)
      return task
    }

    const applyTheme = (theme: DesktopTheme, themeId: string, mode: "light" | "dark") => {
      applyThemeCss(theme, themeId, mode)
      props.onThemeApplied?.(theme, mode)
    }

    const persistCurated = (entry: CuratedThemeEntry, colorScheme: ColorScheme) => {
      write(STORAGE_KEYS.curatedKey, entry.key)
      write(STORAGE_KEYS.themeId, entry.themeId)
      write(STORAGE_KEYS.colorScheme, colorScheme)
    }

    const applyCuratedEntry = (entry: CuratedThemeEntry, colorScheme?: ColorScheme) => {
      const scheme = colorScheme ?? paletteColorScheme(entry)
      const mode = modeFromScheme(scheme)
      setStore("themeId", entry.themeId)
      setStore("curatedKey", entry.key as CuratedThemeKey)
      setStore("colorScheme", scheme)
      setStore("mode", mode)
      persistCurated(entry, scheme)
      if (!isInlineTheme(entry.themeId)) clearThemeCache()
      void load(entry.themeId).then((theme) => {
        if (!theme || store.themeId !== entry.themeId) return
        if (!isInlineTheme(entry.themeId)) cacheThemeVariants(theme, entry.themeId)
      })
    }

    const setCuratedTheme = (key: string) => {
      const entry = curatedEntryForKey(key)
      if (!entry) return
      applyCuratedEntry(entry)
    }

    const setTheme = (id: string) => {
      const slug = resolveThemeSlug(id)
      const entry = curatedEntryForThemeId(slug, store.mode) ?? CURATED_THEME_ENTRIES.find((item) => item.themeId === slug)
      if (entry) {
        applyCuratedEntry(entry)
        return
      }
      setStore("themeId", slug)
      write(STORAGE_KEYS.themeId, slug)
      if (!isInlineTheme(slug)) clearThemeCache()
      void load(slug).then((theme) => {
        if (!theme || store.themeId !== slug) return
        if (!isInlineTheme(slug)) cacheThemeVariants(theme, slug)
      })
    }

    const setColorScheme = (scheme: ColorScheme) => {
      const mode = modeFromScheme(scheme)
      const entry = curatedEntryForResolvedMode(store.themeId, scheme)

      setStore("colorScheme", scheme)
      write(STORAGE_KEYS.colorScheme, scheme)
      setStore("mode", mode)

      if (entry) {
        setStore("curatedKey", entry.key as CuratedThemeKey)
        write(STORAGE_KEYS.curatedKey, entry.key)
      }
    }

    const loadThemes = () => Promise.all(curatedThemeIds(themeIDs()).map(load)).then(() => store.themes)

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.curatedKey && e.newValue && isCuratedThemeKey(e.newValue)) {
        const entry = curatedEntryForKey(e.newValue)
        if (!entry) return
        setStore("themeId", entry.themeId)
        setStore("curatedKey", e.newValue)
        const scheme = paletteColorScheme(entry)
        setStore("colorScheme", scheme)
        setStore("mode", modeFromScheme(scheme))
        void load(entry.themeId).then((theme) => {
          if (!theme || store.themeId !== entry.themeId) return
          if (!isInlineTheme(entry.themeId)) cacheThemeVariants(theme, entry.themeId)
        })
        return
      }
      if ((e.key === STORAGE_KEYS.themeId || e.key === LEGACY_KEYS.themeId) && e.newValue) {
        const slug = resolveThemeSlug(e.newValue)
        const key = resolveCuratedKey(read(STORAGE_KEYS.curatedKey), slug, store.colorScheme)
        const entry = curatedEntryForKey(key)
        if (!entry) return
        setStore("themeId", entry.themeId)
        setStore("curatedKey", key)
        void load(entry.themeId).then((theme) => {
          if (!theme || store.themeId !== entry.themeId) return
          if (!isInlineTheme(entry.themeId)) cacheThemeVariants(theme, entry.themeId)
        })
      }
      if ((e.key === STORAGE_KEYS.colorScheme || e.key === LEGACY_KEYS.colorScheme) && e.newValue) {
        const scheme = schemeFromStorage(e.newValue)
        const mode = modeFromScheme(scheme)
        setStore("colorScheme", scheme)
        setStore("mode", mode)
        const entry = curatedEntryForResolvedMode(store.themeId, scheme)
        if (entry) {
          setStore("curatedKey", entry.key as CuratedThemeKey)
        }
      }
    }

    onMount(() => {
      makeEventListener(window, "storage", onStorage)

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const onMedia = () => {
        if (store.colorScheme !== "system") return
        const mode = getSystemMode()
        setStore("mode", mode)
        const entry = curatedEntryForThemeId(store.themeId, mode)
        if (entry) {
          setStore("curatedKey", entry.key as CuratedThemeKey)
          write(STORAGE_KEYS.curatedKey, entry.key)
        }
      }
      makeEventListener(mediaQuery, "change", onMedia)

      if (rawCuratedKey !== savedCuratedKey || rawThemeId !== savedEntry.themeId) {
        persistCurated(savedEntry, savedColorScheme)
      }

      void load(savedEntry.themeId).then((theme) => {
        if (!theme || store.themeId !== savedEntry.themeId) return
        if (!isInlineTheme(savedEntry.themeId)) cacheThemeVariants(theme, savedEntry.themeId)
      })
    })

    createEffect(() => {
      const theme = store.themes[store.themeId]
      if (!theme) return
      applyTheme(theme, store.themeId, store.mode)
    })

    return {
      themeId: () => store.themeId,
      curatedKey: () => store.curatedKey,
      colorScheme: () => store.colorScheme,
      mode: () => store.mode,
      ids: () => curatedThemeIds(themeIDs().filter((id) => !HIDDEN_THEME_IDS.has(id))),
      curatedEntries: () => CURATED_THEME_ENTRIES,
      curatedKeys,
      curatedLabel: () => curatedEntryForKey(store.curatedKey)?.label ?? store.curatedKey,
      name: (id: string) => store.themes[id]?.name ?? id,
      loadThemes,
      themes: () => store.themes,
      setTheme,
      setCuratedTheme,
      setColorScheme,
      terminalTheme: () => resolveTerminalTheme(store.themes[store.themeId], store.mode),
      registerTheme: (theme: DesktopTheme) => setStore("themes", theme.id, theme),
      previewCuratedTheme: (key: string) => {
        const entry = curatedEntryForKey(key)
        if (!entry) return
        setStore("previewCuratedKey", entry.key as CuratedThemeKey)
        void load(entry.themeId).then((theme) => {
          if (!theme || store.previewCuratedKey !== entry.key) return
          const mode = store.previewScheme
            ? store.previewScheme === "system"
              ? getSystemMode()
              : store.previewScheme
            : entryMode(entry)
          applyTheme(theme, entry.themeId, mode)
        })
      },
      previewTheme: (id: string) => {
        const slug = resolveThemeSlug(id)
        const entry = curatedEntryForThemeId(slug, store.mode) ?? CURATED_THEME_ENTRIES.find((item) => item.themeId === slug)
        if (entry) {
          setStore("previewCuratedKey", entry.key as CuratedThemeKey)
          void load(entry.themeId).then((theme) => {
            if (!theme || store.previewCuratedKey !== entry.key) return
            applyTheme(theme, entry.themeId, entryMode(entry))
          })
        }
      },
      previewColorScheme: (scheme: ColorScheme) => {
        setStore("previewScheme", scheme)
        const active = curatedEntryForKey(store.previewCuratedKey ?? store.curatedKey)
        if (!active) return
        const mode = modeFromScheme(scheme)
        const entry = curatedEntryForResolvedMode(active.themeId, scheme) ?? active
        void load(entry.themeId).then((theme) => {
          if (!theme) return
          if (store.previewScheme !== scheme) return
          applyTheme(theme, entry.themeId, mode)
        })
      },
      commitPreview: () => {
        if (store.previewCuratedKey) {
          setCuratedTheme(store.previewCuratedKey)
        }
        if (store.previewScheme) {
          setColorScheme(store.previewScheme)
        }
        setStore("previewCuratedKey", null)
        setStore("previewScheme", null)
      },
      cancelPreview: () => {
        setStore("previewCuratedKey", null)
        setStore("previewScheme", null)
        const entry = curatedEntryForKey(store.curatedKey)
        if (!entry) return
        void load(entry.themeId).then((theme) => {
          if (!theme) return
          applyTheme(theme, entry.themeId, store.mode)
        })
      },
    }
  },
})
