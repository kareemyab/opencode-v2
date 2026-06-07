/** Maps vscode workbench color keys to opencode v1 override tokens. */
export const VSCODE_COLOR_OVERRIDES: Record<string, string> = {
  "editor.background": "background-base",
  "editor.foreground": "text-strong",
  "sideBar.background": "surface-base",
  "activityBar.background": "background-strong",
  "panel.background": "background-base",
  "statusBar.background": "background-base",
  "titleBar.activeBackground": "background-base",
  "tab.activeBackground": "surface-raised-base",
  "tab.inactiveBackground": "surface-inset-base",
  "input.background": "input-base",
  "dropdown.background": "input-base",
  "list.activeSelectionBackground": "surface-interactive-base",
  "list.hoverBackground": "surface-raised-base-hover",
  "editorLineNumber.foreground": "text-weaker",
  "editorLineNumber.activeForeground": "text-weak",
  "editor.selectionBackground": "surface-interactive-weak",
  "editor.lineHighlightBackground": "surface-inset-base",
  "editorCursor.foreground": "text-strong",
  "focusBorder": "border-focus",
  "button.background": "button-primary-base",
  "button.foreground": "text-on-brand-base",
  "textLink.foreground": "text-interactive-base",
  "descriptionForeground": "text-weak",
  "errorForeground": "text-on-critical-base",
}

/** TextMate scope fragments matched in order for syntax token overrides. */
export const SYNTAX_SCOPE_MAP: Array<{ scopes: string[]; token: string }> = [
  { scopes: ["comment", "punctuation.definition.comment"], token: "syntax-comment" },
  { scopes: ["string", "constant.other.symbol", "markup.raw"], token: "syntax-string" },
  {
    scopes: ["keyword", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new"],
    token: "syntax-keyword",
  },
  { scopes: ["constant.numeric", "constant.language", "constant.character"], token: "syntax-primitive" },
  { scopes: ["variable", "variable.other", "entity.name.variable"], token: "syntax-variable" },
  { scopes: ["variable.other.property", "support.variable.property", "variable.other.object.property"], token: "syntax-property" },
  { scopes: ["entity.name.type", "support.type", "entity.name.class", "support.class"], token: "syntax-type" },
  { scopes: ["constant", "variable.other.constant", "entity.name.constant"], token: "syntax-constant" },
  { scopes: ["keyword.operator", "punctuation"], token: "syntax-operator" },
  { scopes: ["entity.name.tag", "meta.object-literal.key"], token: "syntax-object" },
  { scopes: ["markup.heading"], token: "markdown-heading" },
  { scopes: ["markup.inline.raw", "markup.fenced_code"], token: "markdown-code" },
  { scopes: ["markup.underline.link"], token: "markdown-link" },
  { scopes: ["markup.bold"], token: "markdown-strong" },
  { scopes: ["markup.italic"], token: "markdown-emph" },
  { scopes: ["markup.quote"], token: "markdown-block-quote" },
]

/** Curated theme slug → vscode source files (relative to theme-defaults/themes/). */
export const THEME_SOURCE_MAP: Record<
  string,
  { name: string; dark: string; light?: string }
> = {
  "2026": { name: "2026", dark: "2026-dark.json", light: "2026-light.json" },
  "orgn-cde-black": { name: "ORGN CDE Black", dark: "orgn_cde_black.json", light: "2026-light.json" },
  "dark-plus": { name: "Dark+", dark: "dark_plus.json", light: "light_plus.json" },
  "dark-modern": { name: "Dark Modern", dark: "dark_modern.json", light: "light_modern.json" },
  "light-plus": { name: "Light+", dark: "dark_plus.json", light: "light_plus.json" },
  "light-modern": { name: "Light Modern", dark: "dark_modern.json", light: "light_modern.json" },
  "visual-studio-dark": { name: "Dark (Visual Studio)", dark: "dark_vs.json", light: "light_vs.json" },
  "visual-studio-light": { name: "Light (Visual Studio)", dark: "dark_vs.json", light: "light_vs.json" },
  "hc-black": { name: "Dark High Contrast", dark: "hc_black.json", light: "hc_light.json" },
  "hc-light": { name: "Light High Contrast", dark: "hc_black.json", light: "hc_light.json" },
  flexoki: { name: "Flexoki", dark: "flexoki-dark.json", light: "flexoki-light.json" },
  penumbra: { name: "Penumbra", dark: "penumbra-dark.json", light: "penumbra-light.json" },
  "kanagawa-wave": { name: "Kanagawa Wave", dark: "kanagawa-wave.json", light: "kanagawa-lotus.json" },
  "kanagawa-dragon": { name: "Kanagawa Dragon", dark: "kanagawa-dragon.json", light: "kanagawa-lotus.json" },
  "kanagawa-lotus": { name: "Kanagawa Lotus", dark: "kanagawa-wave.json", light: "kanagawa-lotus.json" },
  poimandres: { name: "poimandres", dark: "poimandres.json" },
  oxocarbon: { name: "oxocarbon", dark: "oxocarbon.json" },
  "oxocarbon-print": { name: "oxocarbon PRINT", dark: "oxocarbon.json", light: "oxocarbon-print.json" },
  rosepine: { name: "Rose Pine", dark: "rose-pine.json" },
  "rose-pine-moon": { name: "Rose Pine Moon", dark: "rose-pine-moon.json" },
  "rose-pine-dawn": { name: "Rose Pine Dawn", dark: "rose-pine.json", light: "rose-pine-dawn.json" },
  "hack-the-box": { name: "Hack The Box", dark: "hack-the-box.json" },
  alabaster: { name: "Alabaster", dark: "alabaster.json", light: "alabaster.json" },
  "selenized-black": { name: "Selenized Black Theme", dark: "selenized-black.json" },
  "gruvbox-material": { name: "Gruvbox Material Dark", dark: "gruvbox-material-dark.json" },
  "phosphor-amber-night": { name: "Phosphor Amber Night", dark: "phosphor-amber-night.json" },
  nightowl: { name: "Night Owl", dark: "night-owl.json" },
  vesper: { name: "Vesper", dark: "vesper.json" },
  melange: { name: "Melange", dark: "melange-dark.json", light: "melange-light.json" },
  everforest: { name: "Everforest", dark: "everforest-dark.json", light: "everforest-light.json" },
  zenbones: { name: "Zenbones", dark: "zenbones-dark.json", light: "zenbones-light.json" },
  cyberdream: { name: "cyberdream", dark: "cyberdream.json" },
  synthwave84: { name: "SynthWave '84", dark: "synthwave-84.json" },
}

/** Default path to vscode-cde theme-defaults (sibling worktree). */
export const VSCODE_THEMES_DIR = new URL(
  "../../../../vscode-cde/extensions/theme-defaults/themes/",
  import.meta.url,
).pathname

export const OUTPUT_DIR = new URL("../src/theme/themes/", import.meta.url).pathname
