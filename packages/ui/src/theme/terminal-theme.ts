import { resolveThemeVariant } from "./resolve"
import type { ColorValue, DesktopTheme, ResolvedTheme, ThemeVariant } from "./types"

export type TerminalAnsiPalette = {
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export type ResolvedTerminalTheme = {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
} & TerminalAnsiPalette

const DARK_ANSI: TerminalAnsiPalette = {
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
}

const LIGHT_ANSI: TerminalAnsiPalette = {
  black: "#000000",
  red: "#cd3131",
  green: "#107c10",
  yellow: "#949800",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#555555",
  brightBlack: "#666666",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#b5ba00",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#1a1a1a",
}

const ANSI_OVERRIDE_KEYS: Array<{ override: string; palette: keyof TerminalAnsiPalette }> = [
  { override: "terminal-ansi-black", palette: "black" },
  { override: "terminal-ansi-red", palette: "red" },
  { override: "terminal-ansi-green", palette: "green" },
  { override: "terminal-ansi-yellow", palette: "yellow" },
  { override: "terminal-ansi-blue", palette: "blue" },
  { override: "terminal-ansi-magenta", palette: "magenta" },
  { override: "terminal-ansi-cyan", palette: "cyan" },
  { override: "terminal-ansi-white", palette: "white" },
  { override: "terminal-ansi-bright-black", palette: "brightBlack" },
  { override: "terminal-ansi-bright-red", palette: "brightRed" },
  { override: "terminal-ansi-bright-green", palette: "brightGreen" },
  { override: "terminal-ansi-bright-yellow", palette: "brightYellow" },
  { override: "terminal-ansi-bright-blue", palette: "brightBlue" },
  { override: "terminal-ansi-bright-magenta", palette: "brightMagenta" },
  { override: "terminal-ansi-bright-cyan", palette: "brightCyan" },
  { override: "terminal-ansi-bright-white", palette: "brightWhite" },
]

const FALLBACK_CORE = {
  light: {
    background: "#ffffff",
    foreground: "#000000",
  },
  dark: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
  },
} as const

function pickColor(overrides: Record<string, ColorValue>, tokens: ResolvedTheme, keys: string[], fallback: string) {
  for (const key of keys) {
    const override = overrides[key]
    if (override?.startsWith("#")) return override
    const token = tokens[key]
    if (token?.startsWith("#")) return token
  }
  return fallback
}

function resolveAnsiPalette(
  overrides: Record<string, ColorValue>,
  mode: "light" | "dark",
): TerminalAnsiPalette {
  const base = mode === "dark" ? DARK_ANSI : LIGHT_ANSI
  const palette = { ...base }

  for (const { override, palette: key } of ANSI_OVERRIDE_KEYS) {
    const value = overrides[override]
    if (value?.startsWith("#")) palette[key] = value
  }

  return palette
}

export function resolveTerminalTheme(
  theme: DesktopTheme | undefined,
  mode: "light" | "dark",
): ResolvedTerminalTheme {
  const fallback = FALLBACK_CORE[mode]
  if (!theme) {
    const palette = mode === "dark" ? DARK_ANSI : LIGHT_ANSI
    return {
      background: fallback.background,
      foreground: fallback.foreground,
      cursor: fallback.foreground,
      cursorAccent: fallback.background,
      selectionBackground: fallback.foreground,
      selectionForeground: fallback.background,
      ...palette,
    }
  }

  const variant = mode === "dark" ? theme.dark : theme.light
  const overrides = variant.overrides ?? {}
  const tokens = resolveThemeVariant(variant, mode === "dark")

  const background = pickColor(overrides, tokens, ["terminal-background", "background-base"], fallback.background)
  const foreground = pickColor(overrides, tokens, ["terminal-foreground", "text-strong"], fallback.foreground)
  const palette = resolveAnsiPalette(overrides, mode)

  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: foreground,
    selectionForeground: background,
    ...palette,
  }
}

export function terminalThemeCss(variant: ThemeVariant, tokens: ResolvedTheme): string {
  const overrides = variant.overrides ?? {}
  const lines: string[] = []

  const background = overrides["terminal-background"] ?? overrides["background-base"] ?? tokens["background-base"]
  const foreground = overrides["terminal-foreground"] ?? overrides["text-strong"] ?? tokens["text-strong"]

  if (background) lines.push(`--terminal-background: ${background};`)
  if (foreground) lines.push(`--terminal-foreground: ${foreground};`)

  for (const { override } of ANSI_OVERRIDE_KEYS) {
    const value = overrides[override]
    if (value) lines.push(`--${override}: ${value};`)
  }

  return lines.join("\n  ")
}
