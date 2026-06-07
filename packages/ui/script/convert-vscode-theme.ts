#!/usr/bin/env bun
/**
 * Convert vscode-cde color theme JSON into opencode DesktopTheme JSON.
 *
 * Usage:
 *   bun run packages/ui/script/convert-vscode-theme.ts --all
 *   bun run packages/ui/script/convert-vscode-theme.ts --slug flexoki
 *   bun run packages/ui/script/convert-vscode-theme.ts --entry flexoki-dark
 *
 * Source: ../vscode-cde/extensions/theme-defaults/themes/ (read-only)
 * Output: packages/ui/src/theme/themes/{slug}.json
 */

import { CURATED_THEME_IDS } from "../src/theme/curated-themes"
import {
  OUTPUT_DIR,
  SYNTAX_SCOPE_MAP,
  THEME_SOURCE_MAP,
  VSCODE_COLOR_OVERRIDES,
  VSCODE_THEMES_DIR,
} from "./vscode-token-map"

type VSCodeTheme = {
  name?: string
  type?: "dark" | "light"
  include?: string
  colors?: Record<string, string>
  tokenColors?: Array<{
    scope?: string | string[]
    settings?: { foreground?: string; background?: string }
  }>
}

type HexColor = `#${string}`

type ThemeVariant = {
  palette: Record<string, HexColor>
  overrides: Record<string, HexColor>
}

type DesktopTheme = {
  $schema: string
  name: string
  id: string
  light: ThemeVariant
  dark: ThemeVariant
}

const args = process.argv.slice(2)

function normalizeHex(value: string | undefined): HexColor | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^#([0-9a-fA-F]{3,8})$/.test(trimmed)) {
    if (trimmed.length === 4) {
      const [, r, g, b] = trimmed
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase() as HexColor
    }
    if (trimmed.length === 5) {
      const [, r, g, b, a] = trimmed
      return `#${r}${r}${g}${g}${b}${b}${a}${a}`.toLowerCase() as HexColor
    }
    return trimmed.slice(0, 7).toLowerCase() as HexColor
  }
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.slice(0, 7).toLowerCase() as HexColor
  return undefined
}

function stripJsonComments(text: string): string {
  let out = ""
  let i = 0
  let inString = false
  let escaped = false

  while (i < text.length) {
    const char = text[i]
    const next = text[i + 1]

    if (inString) {
      out += char
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      i++
      continue
    }

    if (char === '"') {
      inString = true
      out += char
      i++
      continue
    }

    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++
      continue
    }

    if (char === "/" && next === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++
      i += 2
      continue
    }

    out += char
    i++
  }

  return out.replace(/,\s*([}\]])/g, "$1")
}

async function resolveThemeFile(path: string, dir: string, seen = new Set<string>()): Promise<VSCodeTheme> {
  const full = `${dir}/${path.replace(/^\.\//, "")}`
  if (seen.has(full)) throw new Error(`Circular include: ${full}`)
  seen.add(full)
  const raw = JSON.parse(stripJsonComments(await Bun.file(full).text())) as VSCodeTheme
  if (!raw.include) return raw
  const base = await resolveThemeFile(raw.include, dir, seen)
  return {
    ...base,
    ...raw,
    colors: { ...base.colors, ...raw.colors },
    tokenColors: [...(base.tokenColors ?? []), ...(raw.tokenColors ?? [])],
  }
}

async function loadResolved(filename: string): Promise<VSCodeTheme> {
  return resolveThemeFile(filename, VSCODE_THEMES_DIR)
}

function pickColor(colors: Record<string, string>, keys: string[]): HexColor | undefined {
  for (const key of keys) {
    const hex = normalizeHex(colors[key])
    if (hex) return hex
  }
  return undefined
}

function buildPalette(colors: Record<string, string>, tokenColors: VSCodeTheme["tokenColors"]): Record<string, HexColor> {
  const syntax = extractSyntax(tokenColors)
  const neutral = pickColor(colors, ["editor.background", "panel.background", "sideBar.background"]) ?? "#1e1e1e"
  const ink = pickColor(colors, ["editor.foreground", "foreground"]) ?? "#cccccc"
  const primary =
    pickColor(colors, ["activityBarBadge.background", "button.background", "focusBorder", "textLink.foreground"]) ??
    "#0078d4"
  const interactive = pickColor(colors, ["textLink.foreground", "button.background", "activityBarBadge.background"]) ?? primary
  const success =
    pickColor(colors, ["gitDecoration.addedResourceForeground", "charts.green", "terminal.ansiGreen"]) ??
    syntax["syntax-keyword"] ??
    "#2ea043"
  const warning =
    pickColor(colors, ["editorWarning.foreground", "inputValidation.warningBorder", "terminal.ansiYellow"]) ?? "#ffaa00"
  const error =
    pickColor(colors, ["editorError.foreground", "inputValidation.errorBorder", "terminal.ansiRed"]) ?? "#ff3333"
  const info =
    pickColor(colors, ["editorInfo.foreground", "activityBarBadge.background", "terminal.ansiBlue"]) ?? primary
  const accent = syntax["syntax-type"] ?? syntax["syntax-primitive"] ?? primary
  const diffAdd = pickColor(colors, ["diffEditor.insertedLineBackground", "gitDecoration.addedResourceForeground"]) ?? success
  const diffDelete = pickColor(colors, ["diffEditor.removedLineBackground", "gitDecoration.deletedResourceForeground"]) ?? error

  return {
    neutral,
    ink,
    primary,
    accent,
    success,
    warning,
    error,
    info,
    interactive,
    diffAdd,
    diffDelete,
  }
}

function scopeMatches(scope: string, fragment: string) {
  return scope === fragment || scope.includes(fragment)
}

function extractSyntax(tokenColors: VSCodeTheme["tokenColors"]): Record<string, HexColor> {
  const out: Record<string, HexColor> = {}
  if (!tokenColors) return out

  for (const { scopes, token } of SYNTAX_SCOPE_MAP) {
    for (const rule of tokenColors) {
      const ruleScopes = Array.isArray(rule.scope) ? rule.scope : rule.scope ? [rule.scope] : []
      const hex = normalizeHex(rule.settings?.foreground)
      if (!hex) continue
      if (ruleScopes.some((scope) => scopes.some((fragment) => scopeMatches(scope, fragment)))) {
        out[token] ??= hex
      }
    }
  }

  return out
}

function buildOverrides(colors: Record<string, string>, tokenColors: VSCodeTheme["tokenColors"]): Record<string, HexColor> {
  const overrides: Record<string, HexColor> = { ...extractSyntax(tokenColors) }

  for (const [vscodeKey, token] of Object.entries(VSCODE_COLOR_OVERRIDES)) {
    const hex = normalizeHex(colors[vscodeKey])
    if (hex) overrides[token] = hex
  }

  const weak = pickColor(colors, ["descriptionForeground", "editorLineNumber.foreground", "tab.inactiveForeground"])
  if (weak) overrides["text-weak"] = weak

  const terminalBackground = pickColor(colors, ["terminal.background", "editor.background"])
  if (terminalBackground) overrides["terminal-background"] = terminalBackground

  const terminalForeground = pickColor(colors, ["terminal.foreground", "editor.foreground"])
  if (terminalForeground) overrides["terminal-foreground"] = terminalForeground

  const terminalAnsiMap: Array<[string, string]> = [
    ["terminal.ansiBlack", "terminal-ansi-black"],
    ["terminal.ansiRed", "terminal-ansi-red"],
    ["terminal.ansiGreen", "terminal-ansi-green"],
    ["terminal.ansiYellow", "terminal-ansi-yellow"],
    ["terminal.ansiBlue", "terminal-ansi-blue"],
    ["terminal.ansiMagenta", "terminal-ansi-magenta"],
    ["terminal.ansiCyan", "terminal-ansi-cyan"],
    ["terminal.ansiWhite", "terminal-ansi-white"],
    ["terminal.ansiBrightBlack", "terminal-ansi-bright-black"],
    ["terminal.ansiBrightRed", "terminal-ansi-bright-red"],
    ["terminal.ansiBrightGreen", "terminal-ansi-bright-green"],
    ["terminal.ansiBrightYellow", "terminal-ansi-bright-yellow"],
    ["terminal.ansiBrightBlue", "terminal-ansi-bright-blue"],
    ["terminal.ansiBrightMagenta", "terminal-ansi-bright-magenta"],
    ["terminal.ansiBrightCyan", "terminal-ansi-bright-cyan"],
    ["terminal.ansiBrightWhite", "terminal-ansi-bright-white"],
  ]

  for (const [vscodeKey, token] of terminalAnsiMap) {
    const hex = normalizeHex(colors[vscodeKey])
    if (hex) overrides[token] = hex
  }

  const markdownText = pickColor(colors, ["editor.foreground"])
  if (markdownText) {
    overrides["markdown-text"] ??= markdownText
    overrides["markdown-code-block"] ??= markdownText
  }

  const link = pickColor(colors, ["textLink.foreground"])
  if (link) {
    overrides["markdown-link"] ??= link
    overrides["markdown-list-item"] ??= link
    overrides["markdown-list-enumeration"] ??= link
    overrides["markdown-image"] ??= link
    overrides["markdown-image-text"] ??= link
  }

  return overrides
}

async function variantFromFile(filename: string): Promise<ThemeVariant> {
  const resolved = await loadResolved(filename)
  const colors = resolved.colors ?? {}
  return {
    palette: buildPalette(colors, resolved.tokenColors),
    overrides: buildOverrides(colors, resolved.tokenColors),
  }
}

async function convertSlug(slug: string): Promise<DesktopTheme> {
  const source = THEME_SOURCE_MAP[slug]
  if (!source) throw new Error(`No source mapping for slug: ${slug}`)

  const darkFile = source.dark
  const lightFile = source.light ?? source.dark

  return {
    $schema: "https://orgn.com/desktop-theme.json",
    name: source.name,
    id: slug,
    dark: await variantFromFile(darkFile),
    light: await variantFromFile(lightFile),
  }
}

async function writeTheme(slug: string) {
  const theme = await convertSlug(slug)
  const path = `${OUTPUT_DIR}/${slug}.json`
  await Bun.write(path, `${JSON.stringify(theme, null, 2)}\n`)
  console.log(`wrote ${path}`)
}

async function main() {
  if (args.includes("--all")) {
    for (const slug of CURATED_THEME_IDS) {
      if (!THEME_SOURCE_MAP[slug]) {
        console.warn(`skip ${slug}: no source mapping`)
        continue
      }
      await writeTheme(slug)
    }
    return
  }

  const slugArg = args.find((a) => a.startsWith("--slug="))?.slice("--slug=".length)
  const entryArg = args.find((a) => a.startsWith("--entry="))?.slice("--entry=".length)

  if (entryArg) {
    const { curatedEntryForKey } = await import("../src/theme/curated-themes")
    const entry = curatedEntryForKey(entryArg)
    if (!entry) throw new Error(`Unknown entry: ${entryArg}`)
    await writeTheme(entry.themeId)
    return
  }

  if (slugArg) {
    await writeTheme(slugArg)
    return
  }

  console.log(`Usage: bun run ${import.meta.path} --all|--slug=<slug>|--entry=<key>`)
  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
