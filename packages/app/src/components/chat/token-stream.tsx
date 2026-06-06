import type { JSX } from "solid-js"
import "./stream-banner.css"

type TokenStreamProps = {
  speed?: number
  dotSize?: number
  cellPadding?: number
  class?: string
  "aria-label"?: string
}

const DOTS = Array.from({ length: 25 }, (_, i) => ({ i, col: i % 5 }))

export function TokenStream(props: TokenStreamProps) {
  const style = (): JSX.CSSProperties => ({
    "--dot-size": `${props.dotSize ?? 1.8}px`,
    "--dot-gap": `${(props.cellPadding ?? 0.25) * 2}px`,
    "--speed": props.speed ?? 2,
  })

  return (
    <div
      class={`token-stream-loader ${props.class ?? ""}`}
      style={style()}
      role="status"
      aria-label={props["aria-label"] ?? "Loading"}
    >
      {DOTS.map((dot) => (
        <span class="dot" style={{ "--col": dot.col }} />
      ))}
    </div>
  )
}
