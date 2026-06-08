const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

export type MermaidViewerLabels = {
  zoomIn: string
  zoomOut: string
  reset: string
  expand: string
  copy: string
  copied: string
}

type MermaidPan = {
  x: number
  y: number
}

type MermaidDragState = {
  block: HTMLDivElement
  pointerId: number
  startX: number
  startY: number
  originPan: MermaidPan
}

export function clampMermaidZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function formatMermaidZoom(value: number) {
  return `${Math.round(value * 100)}%`
}

export function getMermaidZoom(block: HTMLDivElement) {
  const raw = block.dataset.zoom
  const parsed = raw ? Number.parseFloat(raw) : 1
  return Number.isFinite(parsed) ? clampMermaidZoom(parsed) : 1
}

export function getMermaidPan(block: HTMLDivElement): MermaidPan {
  const x = Number.parseFloat(block.dataset.panX ?? "0")
  const y = Number.parseFloat(block.dataset.panY ?? "0")
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  }
}

export function applyMermaidTransform(block: HTMLDivElement, dragging = block.dataset.dragging === "true") {
  const canvas = block.querySelector('[data-slot="markdown-mermaid-canvas"]')
  if (!(canvas instanceof HTMLElement)) return

  const zoom = getMermaidZoom(block)
  const pan = getMermaidPan(block)
  canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
  canvas.style.transition = dragging ? "none" : "transform 0.12s ease-out"

  const label = block.querySelector('[data-slot="markdown-mermaid-zoom-level"]')
  if (label) label.textContent = formatMermaidZoom(zoom)
}

export function setMermaidZoom(block: HTMLDivElement, zoom: number) {
  block.dataset.zoom = String(clampMermaidZoom(zoom))
  applyMermaidTransform(block)
}

export function setMermaidPan(block: HTMLDivElement, pan: MermaidPan) {
  block.dataset.panX = String(pan.x)
  block.dataset.panY = String(pan.y)
  applyMermaidTransform(block)
}

export function wrapMermaidSVG(svg: Element) {
  const viewport = document.createElement("div")
  viewport.setAttribute("data-slot", "markdown-mermaid-viewport")

  const canvas = document.createElement("div")
  canvas.setAttribute("data-slot", "markdown-mermaid-canvas")
  canvas.appendChild(svg)

  viewport.appendChild(canvas)
  return viewport
}

export function ensureMermaidViewport(block: HTMLDivElement) {
  if (block.querySelector('[data-slot="markdown-mermaid-viewport"]')) return

  const svg = block.querySelector('[data-slot="markdown-mermaid-svg"]')
  if (!(svg instanceof SVGSVGElement)) return

  const viewport = wrapMermaidSVG(svg)
  block.insertBefore(viewport, block.firstChild)
}

function createZoomButton(slot: string, label: string, text: string) {
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("data-component", "icon-button")
  button.setAttribute("data-variant", "secondary")
  button.setAttribute("data-size", "small")
  button.setAttribute("data-slot", slot)
  button.setAttribute("aria-label", label)
  button.setAttribute("data-tooltip", label)
  button.textContent = text
  button.classList.add("markdown-mermaid-zoom-text")
  return button
}

export function createMermaidToolbar(labels: MermaidViewerLabels) {
  const toolbar = document.createElement("div")
  toolbar.setAttribute("data-slot", "markdown-mermaid-toolbar")

  toolbar.appendChild(createZoomButton("markdown-mermaid-zoom-out", labels.zoomOut, "−"))
  toolbar.appendChild(createZoomButton("markdown-mermaid-zoom-in", labels.zoomIn, "+"))

  const level = document.createElement("span")
  level.setAttribute("data-slot", "markdown-mermaid-zoom-level")
  level.textContent = "100%"
  toolbar.appendChild(level)

  const expand = document.createElement("button")
  expand.type = "button"
  expand.setAttribute("data-component", "icon-button")
  expand.setAttribute("data-variant", "secondary")
  expand.setAttribute("data-size", "small")
  expand.setAttribute("data-slot", "markdown-mermaid-expand")
  expand.setAttribute("data-icon", "expand")
  expand.setAttribute("aria-label", labels.expand)
  expand.setAttribute("data-tooltip", labels.expand)
  const expandIcon = document.createElement("div")
  expandIcon.setAttribute("data-component", "icon")
  expandIcon.setAttribute("data-size", "small")
  const expandSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  expandSvg.setAttribute("data-slot", "icon-svg")
  expandSvg.setAttribute("fill", "none")
  expandSvg.setAttribute("viewBox", "0 0 20 20")
  expandSvg.setAttribute("aria-hidden", "true")
  expandSvg.innerHTML =
    '<path d="M4.58301 10.4163V15.4163H9.58301M10.4163 4.58301H15.4163V9.58301" stroke="currentColor" stroke-linecap="square"/>'
  expandIcon.appendChild(expandSvg)
  expand.appendChild(expandIcon)
  toolbar.appendChild(expand)

  return toolbar
}

function removeLegacyResetButton(block: HTMLDivElement) {
  block.querySelector('[data-slot="markdown-mermaid-zoom-reset"]')?.remove()
}

export function ensureMermaidToolbar(block: HTMLDivElement, labels: MermaidViewerLabels) {
  if (block.dataset.state !== "rendered") return

  ensureMermaidViewport(block)
  removeLegacyResetButton(block)

  let toolbar = block.querySelector('[data-slot="markdown-mermaid-toolbar"]')
  if (!toolbar) {
    toolbar = createMermaidToolbar(labels)
    block.insertBefore(toolbar, block.firstChild)
  }

  applyMermaidTransform(block)
}

export function getMermaidSvgHtml(block: HTMLDivElement) {
  const svg = block.querySelector('[data-slot="markdown-mermaid-svg"]')
  if (!(svg instanceof SVGSVGElement)) return ""
  return svg.outerHTML
}

export function setupMermaidViewer(
  root: HTMLDivElement,
  options: {
    onExpand: (svgHtml: string) => void
  },
) {
  let drag: MermaidDragState | undefined

  const endDrag = (block?: HTMLDivElement) => {
    if (block) {
      delete block.dataset.dragging
      applyMermaidTransform(block)
    }
    drag = undefined
  }

  const handleClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const block = target.closest('[data-component="markdown-mermaid"]')
    if (!(block instanceof HTMLDivElement) || block.dataset.state !== "rendered") return

    const zoomOut = target.closest('[data-slot="markdown-mermaid-zoom-out"]')
    if (zoomOut) {
      event.preventDefault()
      setMermaidZoom(block, getMermaidZoom(block) - ZOOM_STEP)
      return
    }

    const zoomIn = target.closest('[data-slot="markdown-mermaid-zoom-in"]')
    if (zoomIn) {
      event.preventDefault()
      setMermaidZoom(block, getMermaidZoom(block) + ZOOM_STEP)
      return
    }

    const expand = target.closest('[data-slot="markdown-mermaid-expand"]')
    if (expand) {
      event.preventDefault()
      const svgHtml = getMermaidSvgHtml(block)
      if (svgHtml) options.onExpand(svgHtml)
    }
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return

    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-slot="markdown-mermaid-toolbar"]')) return

    const viewport = target.closest('[data-slot="markdown-mermaid-viewport"]')
    if (!(viewport instanceof HTMLElement)) return

    const block = viewport.closest('[data-component="markdown-mermaid"]')
    if (!(block instanceof HTMLDivElement) || block.dataset.state !== "rendered") return

    const pan = getMermaidPan(block)
    drag = {
      block,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPan: pan,
    }
    block.dataset.dragging = "true"
    viewport.setPointerCapture(event.pointerId)
    applyMermaidTransform(block, true)
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return

    setMermaidPan(drag.block, {
      x: drag.originPan.x + (event.clientX - drag.startX),
      y: drag.originPan.y + (event.clientY - drag.startY),
    })
    applyMermaidTransform(drag.block, true)
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return

    const viewport = drag.block.querySelector('[data-slot="markdown-mermaid-viewport"]')
    if (viewport instanceof HTMLElement && viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId)
    }

    endDrag(drag.block)
  }

  const handleWheel = (event: WheelEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const block = target.closest('[data-component="markdown-mermaid"]')
    if (!(block instanceof HTMLDivElement) || block.dataset.state !== "rendered") return
    if (!target.closest('[data-slot="markdown-mermaid-viewport"]')) return

    event.preventDefault()
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setMermaidZoom(block, getMermaidZoom(block) + delta)
  }

  root.addEventListener("click", handleClick)
  root.addEventListener("pointerdown", handlePointerDown)
  root.addEventListener("pointermove", handlePointerMove)
  root.addEventListener("pointerup", handlePointerUp)
  root.addEventListener("pointercancel", handlePointerUp)
  root.addEventListener("wheel", handleWheel, { passive: false })

  return () => {
    root.removeEventListener("click", handleClick)
    root.removeEventListener("pointerdown", handlePointerDown)
    root.removeEventListener("pointermove", handlePointerMove)
    root.removeEventListener("pointerup", handlePointerUp)
    root.removeEventListener("pointercancel", handlePointerUp)
    root.removeEventListener("wheel", handleWheel)
  }
}
