import { onCleanup, onMount, type Component } from "solid-js"
import CanvasKitInit, {
  type CanvasKit,
  type ManagedSkottieAnimation,
  type Surface,
} from "canvaskit-wasm/full"

const LOTTIE_URL = "/orgn-logo-lottie.json"

/** Intro verification reveal — plays once (2.5s @ 60fps). */
const INTRO_END = 150
/** Steady-state monitoring sweep — loops after intro (3.5s @ 60fps). */
const IDLE_END = 360

let canvasKitPromise: Promise<CanvasKit> | null = null

function loadCanvasKit() {
  if (!canvasKitPromise) {
    canvasKitPromise = CanvasKitInit({
      locateFile: () => "/canvaskit.wasm",
    })
  }
  return canvasKitPromise
}

/**
 * Skottie-rendered orgn wordmark for the id-orgn sign-in gate.
 * Phase 1: one-shot verification reveal. Phase 2: slow attestation sweep loop.
 */
export const OrgnLogoLottie: Component<{ class?: string; large?: boolean }> = (props) => {
  let canvas!: HTMLCanvasElement
  let rafId = 0
  let surface: Surface | null = null
  let animation: ManagedSkottieAnimation | null = null
  let ck: CanvasKit | null = null
  let resizeObserver: ResizeObserver | undefined
  let playing = false
  let introDone = false
  let currentFrame = 0
  let lastTs = 0
  let fps = 60

  const resize = () => {
    if (!canvas || !ck) return
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))
    if (canvas.width === width && canvas.height === height && surface) return
    canvas.width = width
    canvas.height = height
    surface?.delete()
    surface = ck.MakeWebGLCanvasSurface(canvas)
  }

  const draw = () => {
    if (!surface || !animation || !ck) return
    const c = surface.getCanvas()
    c.clear(ck.TRANSPARENT)
    const [w, h] = animation.size()
    const cw = canvas.width
    const ch = canvas.height
    const scale = Math.min(cw / w, ch / h)
    const dw = w * scale
    const dh = h * scale
    const left = (cw - dw) / 2
    const top = (ch - dh) / 2
    animation.seekFrame(currentFrame)
    animation.render(c, ck.LTRBRect(left, top, left + dw, top + dh))
    surface.flush()
  }

  const advanceFrame = (dt: number) => {
    currentFrame += dt * fps
    if (!introDone) {
      if (currentFrame >= INTRO_END) {
        introDone = true
        currentFrame = INTRO_END
      }
      return
    }
    if (currentFrame >= IDLE_END) {
      currentFrame = INTRO_END + ((currentFrame - INTRO_END) % (IDLE_END - INTRO_END))
    }
  }

  const tick = (ts: number) => {
    if (playing) {
      if (lastTs !== 0) advanceFrame((ts - lastTs) / 1000)
      lastTs = ts
      draw()
    }
    rafId = requestAnimationFrame(tick)
  }

  onMount(() => {
    let disposed = false

    void (async () => {
      ck = await loadCanvasKit()
      if (disposed) return

      const res = await fetch(LOTTIE_URL)
      if (!res.ok || disposed) return
      animation = ck.MakeManagedAnimation(await res.text())
      if (!animation || disposed) return

      fps = animation.fps() || 60
      resize()
      draw()

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        introDone = true
        currentFrame = INTRO_END
        draw()
        return
      }

      playing = true
      rafId = requestAnimationFrame(tick)

      resizeObserver = new ResizeObserver(() => {
        resize()
        draw()
      })
      resizeObserver.observe(canvas)
    })()

    onCleanup(() => {
      disposed = true
      playing = false
      cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      surface?.delete()
      animation?.delete()
      surface = null
      animation = null
    })
  })

  return (
    <canvas
      ref={canvas}
      aria-label="Orgn"
      class={`block aspect-square ${props.large ? "w-[min(420px,70vw)]" : "w-[280px]"} ${props.class ?? ""}`}
    />
  )
}
