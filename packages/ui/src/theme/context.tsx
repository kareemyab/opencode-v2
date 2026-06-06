// @refresh reload

import { createEffect, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import {
  LEGACY_THEME_STORAGE,
  ORGN_RADIUS_CSS,
  ORGN_THEME_COLORS,
  THEME_ID_DEFAULT,
  THEME_STORAGE,
  THEME_STYLE_ID,
} from "../brand"
import { createSimpleContext } from "../context/helper"
import orgnThemeJson from "./themes/orgn.json"
import { resolveThemeVariant, themeToCss } from "./resolve"
import { resolveThemeVariantV2, themeV2ToCss } from "./v2/resolve"
import type { DesktopTheme } from "./types"

export type ColorScheme = "light" | "dark" | "system"

const STORAGE_KEYS = THEME_STORAGE
const LEGACY_KEYS = LEGACY_THEME_STORAGE
const BUILTIN_THEME_ID = THEME_ID_DEFAULT
const HIDDEN_THEME_IDS = new Set(["opencode", "oc-2"])

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

const names: Record<string, string> = {
  orgn: "orgn",
  "oc-2": "OC-2",
  amoled: "AMOLED",
  aura: "Aura",
  ayu: "Ayu",
  carbonfox: "Carbonfox",
  catppuccin: "Catppuccin",
  "catppuccin-frappe": "Catppuccin Frappe",
  "catppuccin-macchiato": "Catppuccin Macchiato",
  cobalt2: "Cobalt2",
  cursor: "Cursor",
  dracula: "Dracula",
  everforest: "Everforest",
  flexoki: "Flexoki",
  github: "GitHub",
  gruvbox: "Gruvbox",
  kanagawa: "Kanagawa",
  "lucent-orng": "Lucent Orng",
  material: "Material",
  matrix: "Matrix",
  mercury: "Mercury",
  monokai: "Monokai",
  nightowl: "Night Owl",
  nord: "Nord",
  "one-dark": "One Dark",
  onedarkpro: "One Dark Pro",
  opencode: "orgn (legacy)",
  orng: "Orng",
  "osaka-jade": "Osaka Jade",
  palenight: "Palenight",
  rosepine: "Rose Pine",
  shadesofpurple: "Shades of Purple",
  solarized: "Solarized",
  synthwave84: "Synthwave '84",
  tokyonight: "Tokyonight",
  vercel: "Vercel",
  vesper: "Vesper",
  zenburn: "Zenburn",
}
const orgnTheme = orgnThemeJson as DesktopTheme

function normalize(id: string | null | undefined) {
  if (id === "oc-1" || id === "oc-2") return BUILTIN_THEME_ID
  return id
}

function isBuiltinTheme(id: string) {
  return id === BUILTIN_THEME_ID
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

function clear() {
  drop(STORAGE_KEYS.themeCssLight)
  drop(STORAGE_KEYS.themeCssDark)
  drop(LEGACY_KEYS.themeCssLight)
  drop(LEGACY_KEYS.themeCssDark)
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

  if (!isBuiltinTheme(themeId)) {
    write(isDark ? STORAGE_KEYS.themeCssDark : STORAGE_KEYS.themeCssLight, `${css}\n  ${v2}`)
  }

  const radiusCss = ORGN_RADIUS_CSS

  const fullCss = `:root {
  color-scheme: ${mode};
  --text-mix-blend-mode: ${isDark ? "plus-lighter" : "multiply"};
  ${radiusCss}
  ${css}
  ${v2}
}`

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
  if (isBuiltinTheme(themeId)) return
  for (const mode of ["light", "dark"] as const) {
    const isDark = mode === "dark"
    const variant = isDark ? theme.dark : theme.light
    const tokens = resolveThemeVariant(variant, isDark)
    const css = themeToCss(tokens)
    const v2 = themeV2ToCss(resolveThemeVariantV2(variant, isDark))
    write(isDark ? STORAGE_KEYS.themeCssDark : STORAGE_KEYS.themeCssLight, `${css}\n  ${v2}`)
  }
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { defaultTheme?: string; onThemeApplied?: (theme: DesktopTheme, mode: "light" | "dark") => void }) => {
    const themeId =
      normalize(readWithLegacy(STORAGE_KEYS.themeId, LEGACY_KEYS.themeId) ?? props.defaultTheme) ?? BUILTIN_THEME_ID
    const colorScheme =
      (readWithLegacy(STORAGE_KEYS.colorScheme, LEGACY_KEYS.colorScheme) as ColorScheme | null) ?? "system"
    const mode = colorScheme === "system" ? getSystemMode() : colorScheme
    const [store, setStore] = createStore({
      themes: {
        [BUILTIN_THEME_ID]: orgnTheme,
      } as Record<string, DesktopTheme>,
      themeId,
      colorScheme,
      mode,
      previewThemeId: null as string | null,
      previewScheme: null as ColorScheme | null,
    })

    const loads = new Map<string, Promise<DesktopTheme | undefined>>()

    const load = (id: string) => {
      const next = normalize(id)
      if (!next) return Promise.resolve(undefined)
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

    const ids = (): string[] => [BUILTIN_THEME_ID]

    const loadThemes = () => Promise.all(themeIDs().map(load)).then(() => store.themes)

    const onStorage = (e: StorageEvent) => {
      if ((e.key === STORAGE_KEYS.themeId || e.key === LEGACY_KEYS.themeId) && e.newValue) {
        const next = normalize(e.newValue)
        if (!next) return
        if (!isBuiltinTheme(next) && !knownThemes().has(next) && !store.themes[next]) return
        setStore("themeId", next)
        if (isBuiltinTheme(next)) {
          clear()
          return
        }
        void load(next).then((theme) => {
          if (!theme || store.themeId !== next) return
          cacheThemeVariants(theme, next)
        })
      }
      if ((e.key === STORAGE_KEYS.colorScheme || e.key === LEGACY_KEYS.colorScheme) && e.newValue) {
        setStore("colorScheme", e.newValue as ColorScheme)
        setStore("mode", e.newValue === "system" ? getSystemMode() : (e.newValue as "light" | "dark"))
      }
    }

    onMount(() => {
      makeEventListener(window, "storage", onStorage)

      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const onMedia = () => {
        if (store.colorScheme !== "system") return
        setStore("mode", getSystemMode())
      }
      makeEventListener(mediaQuery, "change", onMedia)

      const rawTheme = readWithLegacy(STORAGE_KEYS.themeId, LEGACY_KEYS.themeId)
      const savedTheme = BUILTIN_THEME_ID
      const savedScheme =
        (readWithLegacy(STORAGE_KEYS.colorScheme, LEGACY_KEYS.colorScheme) as ColorScheme | null) ?? "system"
      if (rawTheme !== savedTheme) {
        write(STORAGE_KEYS.themeId, savedTheme)
        clear()
      }
      if (store.themeId !== savedTheme) setStore("themeId", savedTheme)
      if (savedScheme !== store.colorScheme) setStore("colorScheme", savedScheme)
      setStore("mode", savedScheme === "system" ? getSystemMode() : savedScheme)
      void load(savedTheme).then((theme) => {
        if (!theme || store.themeId !== savedTheme) return
        cacheThemeVariants(theme, savedTheme)
      })
    })

    createEffect(() => {
      const theme = store.themes[store.themeId]
      if (!theme) return
      applyTheme(theme, store.themeId, store.mode)
    })

    const setTheme = (_id: string) => {
      const next = BUILTIN_THEME_ID
      setStore("themeId", next)
      write(STORAGE_KEYS.themeId, next)
      clear()
      void load(next).then((theme) => {
        if (!theme || store.themeId !== next) return
        cacheThemeVariants(theme, next)
        write(STORAGE_KEYS.themeId, next)
      })
    }

    const setColorScheme = (scheme: ColorScheme) => {
      setStore("colorScheme", scheme)
      write(STORAGE_KEYS.colorScheme, scheme)
      setStore("mode", scheme === "system" ? getSystemMode() : scheme)
    }

    return {
      themeId: () => store.themeId,
      colorScheme: () => store.colorScheme,
      mode: () => store.mode,
      ids,
      name: (id: string) => store.themes[id]?.name ?? names[id] ?? id,
      loadThemes,
      themes: () => store.themes,
      setTheme,
      setColorScheme,
      registerTheme: (theme: DesktopTheme) => setStore("themes", theme.id, theme),
      previewTheme: (_id: string) => {
        const next = BUILTIN_THEME_ID
        setStore("previewThemeId", next)
        void load(next).then((theme) => {
          if (!theme || store.previewThemeId !== next) return
          const mode = store.previewScheme
            ? store.previewScheme === "system"
              ? getSystemMode()
              : store.previewScheme
            : store.mode
          applyTheme(theme, next, mode)
        })
      },
      previewColorScheme: (scheme: ColorScheme) => {
        setStore("previewScheme", scheme)
        const mode = scheme === "system" ? getSystemMode() : scheme
        const id = store.previewThemeId ?? store.themeId
        void load(id).then((theme) => {
          if (!theme) return
          if ((store.previewThemeId ?? store.themeId) !== id) return
          if (store.previewScheme !== scheme) return
          applyTheme(theme, id, mode)
        })
      },
      commitPreview: () => {
        if (store.previewThemeId) {
          setTheme(store.previewThemeId)
        }
        if (store.previewScheme) {
          setColorScheme(store.previewScheme)
        }
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
      },
      cancelPreview: () => {
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
        void load(store.themeId).then((theme) => {
          if (!theme) return
          applyTheme(theme, store.themeId, store.mode)
        })
      },
    }
  },
})
