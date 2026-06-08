import { Dialog as Kobalte } from "@kobalte/core/dialog"
import { createSignal, onCleanup, onMount } from "solid-js"
import { useI18n } from "../context/i18n"
import { IconButton } from "./icon-button"

export interface MermaidPreviewProps {
  svgHtml: string
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function MermaidPreview(props: MermaidPreviewProps) {
  const i18n = useI18n()
  const [zoom, setZoom] = createSignal(1)
  const [pan, setPan] = createSignal({ x: 0, y: 0 })
  const [dragging, setDragging] = createSignal(false)
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = createSignal(false)

  let containerRef: HTMLDivElement | undefined
  let rootRef: HTMLDivElement | undefined
  let canvasRef: HTMLDivElement | undefined

  const zoomPercent = () => Math.round(zoom() * 100)

  const handleZoomIn = () => setZoom((value) => clampZoom(value * 1.2))
  const handleZoomOut = () => setZoom((value) => clampZoom(value / 1.2))

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleFit = () => {
    const container = containerRef
    const canvas = canvasRef
    if (!container || !canvas) return

    const svg = canvas.querySelector("svg")
    if (!(svg instanceof SVGSVGElement)) return

    const padding = 48
    const containerRect = container.getBoundingClientRect()
    const svgRect = svg.getBoundingClientRect()
    if (svgRect.width <= 0 || svgRect.height <= 0) return

    const fitZoom = clampZoom(
      Math.min(
        (containerRect.width - padding) / svgRect.width,
        (containerRect.height - padding) / svgRect.height,
        1,
      ),
    )

    setZoom(fitZoom)
    setPan({ x: 0, y: 0 })
  }

  const toggleFullscreen = async () => {
    if (!rootRef) return
    if (!document.fullscreenElement) {
      await rootRef.requestFullscreen()
      return
    }
    await document.exitFullscreen()
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    setDragging(true)
    setDragStart({ x: event.clientX - pan().x, y: event.clientY - pan().y })
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!dragging()) return
    setPan({
      x: event.clientX - dragStart().x,
      y: event.clientY - dragStart().y,
    })
  }

  const handlePointerUp = (event: PointerEvent) => {
    setDragging(false)
    if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    setZoom((value) => clampZoom(value * delta))
  }

  onMount(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFullscreenChange)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        handleZoomIn()
      }
      if (event.key === "-") {
        event.preventDefault()
        handleZoomOut()
      }
      if (event.key === "0") {
        event.preventDefault()
        handleReset()
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault()
        void toggleFullscreen()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    requestAnimationFrame(() => handleFit())

    onCleanup(() => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      window.removeEventListener("keydown", onKeyDown)
    })
  })

  return (
    <div
      data-component="mermaid-preview"
      classList={{ "is-fullscreen": isFullscreen() }}
      ref={(node) => {
        rootRef = node
      }}
    >
      <div data-slot="mermaid-preview-container">
        <Kobalte.Content data-slot="mermaid-preview-content">
          <div data-slot="mermaid-preview-header">
            <div data-slot="mermaid-preview-controls">
              <IconButton
                type="button"
                icon="plus-small"
                variant="ghost"
                size="small"
                aria-label={i18n.t("ui.mermaidPreview.zoomIn")}
                data-tooltip={i18n.t("ui.mermaidPreview.zoomIn")}
                onClick={handleZoomIn}
              />
              <span data-slot="mermaid-preview-zoom">{zoomPercent()}%</span>
              <button
                type="button"
                data-component="icon-button"
                data-variant="ghost"
                data-size="small"
                aria-label={i18n.t("ui.mermaidPreview.zoomOut")}
                data-tooltip={i18n.t("ui.mermaidPreview.zoomOut")}
                onClick={handleZoomOut}
              >
                <span data-slot="mermaid-preview-zoom-out">−</span>
              </button>
              <IconButton
                type="button"
                icon="collapse"
                variant="ghost"
                size="small"
                aria-label={i18n.t("ui.mermaidPreview.reset")}
                data-tooltip={i18n.t("ui.mermaidPreview.reset")}
                onClick={handleReset}
              />
              <button
                type="button"
                data-slot="mermaid-preview-fit"
                onClick={handleFit}
              >
                {i18n.t("ui.mermaidPreview.fit")}
              </button>
            </div>

            <div data-slot="mermaid-preview-actions">
              <IconButton
                type="button"
                icon={isFullscreen() ? "collapse" : "expand"}
                variant="ghost"
                size="small"
                aria-label={
                  isFullscreen()
                    ? i18n.t("ui.mermaidPreview.exitFullscreen")
                    : i18n.t("ui.mermaidPreview.fullscreen")
                }
                data-tooltip={
                  isFullscreen()
                    ? i18n.t("ui.mermaidPreview.exitFullscreen")
                    : i18n.t("ui.mermaidPreview.fullscreen")
                }
                onClick={() => void toggleFullscreen()}
              />
              <Kobalte.CloseButton
                data-slot="mermaid-preview-close"
                as={IconButton}
                icon="close"
                variant="ghost"
                size="small"
                aria-label={i18n.t("ui.common.close")}
                data-tooltip={i18n.t("ui.common.close")}
              />
            </div>
          </div>

          <div
            data-slot="mermaid-preview-body"
            ref={(node) => {
              containerRef = node
            }}
            classList={{ "is-dragging": dragging() }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <div
              data-slot="mermaid-preview-canvas"
              ref={(node) => {
                canvasRef = node
              }}
              style={{
                transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
                transition: dragging() ? "none" : "transform 0.12s ease-out",
              }}
              innerHTML={props.svgHtml}
            />
          </div>

          <div data-slot="mermaid-preview-hint">{i18n.t("ui.mermaidPreview.hint")}</div>
        </Kobalte.Content>
      </div>
    </div>
  )
}
