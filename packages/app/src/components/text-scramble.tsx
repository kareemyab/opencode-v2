import { createEffect, createMemo, createSignal, onCleanup, untrack, type JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

export type TextScrambleProps = {
  children: string
  duration?: number
  speed?: number
  characterSet?: string
  as?: string
  class?: string
  trigger?: boolean
  onScrambleComplete?: () => void
}

/**
 * SolidJS port of the orgn `TextScramble` effect: while `trigger` is true, the text
 * resolves from a random character cascade. Runs once per trigger transition.
 */
export function TextScramble(props: TextScrambleProps): JSX.Element {
  const text = createMemo(() => props.children)
  const [displayText, setDisplayText] = createSignal(props.children)

  let interval: ReturnType<typeof setInterval> | null = null
  let animating = false
  let triggered = false

  const stop = () => {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  const scramble = () => {
    if (animating) return
    animating = true
    const value = text()
    const duration = props.duration ?? 0.8
    const speed = props.speed ?? 0.04
    const chars = props.characterSet ?? DEFAULT_CHARS
    const steps = duration / speed
    let step = 0

    stop()
    interval = setInterval(
      () => {
        let scrambled = ""
        const progress = step / steps
        for (let i = 0; i < value.length; i++) {
          if (value[i] === " ") {
            scrambled += " "
            continue
          }
          if (progress * value.length > i) {
            scrambled += value[i]
          } else {
            scrambled += chars[Math.floor(Math.random() * chars.length)]
          }
        }
        setDisplayText(scrambled)
        step++
        if (step > steps) {
          stop()
          setDisplayText(value)
          animating = false
          props.onScrambleComplete?.()
        }
      },
      speed * 1000,
    )
  }

  // Keep the rendered text in sync when the source text changes.
  createEffect(() => {
    const value = text()
    stop()
    animating = false
    setDisplayText(value)
  })

  // Run the scramble once each time `trigger` transitions to true.
  createEffect(() => {
    const active = props.trigger ?? true
    if (!active) {
      triggered = false
      return
    }
    if (!triggered) {
      triggered = true
      untrack(scramble)
    }
  })

  onCleanup(stop)

  return (
    <Dynamic component={props.as ?? "p"} class={props.class}>
      {displayText()}
    </Dynamic>
  )
}
