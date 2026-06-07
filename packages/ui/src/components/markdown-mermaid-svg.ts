import DOMPurify from "dompurify"

function getDOMPurify() {
  if (typeof window === "undefined" || !DOMPurify.isSupported) return
  return DOMPurify
}

const MERMAID_LABEL_COLOR = "#f4f4f5"

const svgSanitizeConfig = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script"],
  ADD_TAGS: ["foreignObject"],
  ADD_ATTR: [
    "x",
    "y",
    "width",
    "height",
    "xmlns",
    "requiredExtensions",
    "class",
    "style",
    "transform",
    "text-anchor",
    "dominant-baseline",
    "font-family",
    "font-size",
    "font-weight",
    "fill",
    "stroke",
    "stroke-width",
  ],
}

const foreignObjectHtmlConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
}

function styleMermaidLabels(root: ParentNode) {
  for (const selector of ["text", "tspan"] as const) {
    root.querySelectorAll(selector).forEach((node) => {
      if (!("getAttribute" in node)) return
      if (!node.getAttribute("fill")) {
        node.setAttribute("fill", MERMAID_LABEL_COLOR)
      }
    })
  }

  root.querySelectorAll("foreignObject").forEach((node) => {
    if (!("querySelectorAll" in node)) return
    let styledChild = false
    for (const selector of ["div", "span", "p"] as const) {
      node.querySelectorAll(selector).forEach((child) => {
        if (!("style" in child)) return
        child.style.color = MERMAID_LABEL_COLOR
        styledChild = true
      })
    }
    if (styledChild) return
    if (node.textContent?.trim()) {
      const wrapper = document.createElement("div")
      wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml")
      wrapper.style.color = MERMAID_LABEL_COLOR
      wrapper.textContent = node.textContent
      node.textContent = ""
      node.appendChild(wrapper)
    }
  })
}

export function sanitizeMermaidSVG(svg: string) {
  const DOMPurify = getDOMPurify()
  if (!DOMPurify) return

  const safe = DOMPurify.sanitize(svg, svgSanitizeConfig)
  const template = document.createElement("template")
  template.innerHTML = safe
  const element = template.content.firstElementChild
  if (!element || element.tagName.toLowerCase() !== "svg") return

  element.querySelectorAll("foreignObject").forEach((foreignObject) => {
    const html = foreignObject.innerHTML
    if (!html) return
    foreignObject.innerHTML = DOMPurify.sanitize(html, foreignObjectHtmlConfig)
  })

  try {
    styleMermaidLabels(element as ParentNode)
  } catch {
    // Styling is best-effort; keep the sanitized SVG either way.
  }

  element.setAttribute("data-slot", "markdown-mermaid-svg")
  element.setAttribute("role", "img")
  element.setAttribute("aria-label", "Mermaid diagram")
  return element
}
