import type { MermaidConfig } from "mermaid"

/**
 * Shared Mermaid theme for dark chat surfaces.
 * Node fills are dark with light labels so SVG text stays readable even when
 * markdown body color cascades into the diagram.
 */
export const MERMAID_THEME_CONFIG: MermaidConfig = {
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  htmlLabels: false,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  flowchart: {
    htmlLabels: false,
  },
  sequence: {
    diagramMarginX: 24,
    diagramMarginY: 12,
    actorMargin: 48,
    width: 150,
    height: 48,
    boxMargin: 8,
    boxTextMargin: 6,
    noteMargin: 8,
    messageMargin: 32,
    mirrorActors: true,
  },
  themeVariables: {
    darkMode: true,
    background: "transparent",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",

    mainBkg: "#27272a",
    primaryColor: "#27272a",
    primaryTextColor: "#f4f4f5",
    primaryBorderColor: "#52525b",

    secondaryColor: "#3f3f46",
    secondaryTextColor: "#f4f4f5",
    secondaryBorderColor: "#71717a",

    tertiaryColor: "#18181b",
    tertiaryTextColor: "#f4f4f5",
    tertiaryBorderColor: "#3f3f46",

    clusterBkg: "#1c1c1f",
    clusterBorder: "#52525b",
    titleColor: "#f4f4f5",
    textColor: "#f4f4f5",
    lineColor: "#a1a1aa",
    edgeLabelBackground: "#18181b",
    nodeTextColor: "#f4f4f5",

    noteBkgColor: "#3f3f46",
    noteTextColor: "#f4f4f5",
    noteBorderColor: "#71717a",

    actorBkg: "#27272a",
    actorBorder: "#52525b",
    actorTextColor: "#f4f4f5",
    actorLineColor: "#71717a",
    signalColor: "#f4f4f5",
    signalTextColor: "#f4f4f5",
    labelBoxBkgColor: "#27272a",
    labelBoxBorderColor: "#52525b",
    labelTextColor: "#f4f4f5",
    loopTextColor: "#f4f4f5",
    activationBkgColor: "#3f3f46",
    activationBorderColor: "#71717a",
    sequenceNumberColor: "#f4f4f5",
  },
}

export function createMermaidConfig(overrides?: Partial<MermaidConfig>): MermaidConfig {
  return {
    ...MERMAID_THEME_CONFIG,
    ...overrides,
    flowchart: {
      ...MERMAID_THEME_CONFIG.flowchart,
      ...overrides?.flowchart,
    },
    sequence: {
      ...MERMAID_THEME_CONFIG.sequence,
      ...overrides?.sequence,
    },
    themeVariables: {
      ...MERMAID_THEME_CONFIG.themeVariables,
      ...overrides?.themeVariables,
    },
  }
}
