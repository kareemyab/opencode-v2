import { Show, type JSX } from "solid-js"

export type CornerBracketPosition = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

export type CornerBracketsProps = {
  class?: string
  /** Sets both the horizontal run (`w-*`) and vertical run (`h-*`) to the same class. */
  size?: string
  /** Tailwind width class for horizontal bracket segments. Overrides `size` for `w` only. */
  armWidth?: string
  /** Tailwind height class for vertical bracket segments. Overrides `size` for `h` only. */
  armHeight?: string
  /** Tailwind `bg-*` class for bracket lines. */
  color?: string
  /** Corners to skip. */
  omitCorners?: CornerBracketPosition[]
}

/**
 * SolidJS port of the orgn `CornerBrackets` decorative frame. Render inside a
 * `relative` parent; the brackets pin to its corners.
 */
export function CornerBrackets(props: CornerBracketsProps): JSX.Element {
  const w = () => props.armWidth ?? props.size ?? "w-3"
  const h = () => props.armHeight ?? props.size ?? "h-3"
  const bg = () => props.color ?? "bg-foreground/12"
  const omit = (corner: CornerBracketPosition) => props.omitCorners?.includes(corner) ?? false

  return (
    <div aria-hidden="true" class={`pointer-events-none ${props.class ?? ""}`}>
      <Show when={!omit("topLeft")}>
        <div class={`absolute top-0 left-0 h-px ${w()} ${bg()}`} />
        <div class={`absolute top-0 left-0 w-px ${h()} ${bg()}`} />
      </Show>
      <Show when={!omit("topRight")}>
        <div class={`absolute top-0 right-0 h-px ${w()} ${bg()}`} />
        <div class={`absolute top-0 right-0 w-px ${h()} ${bg()}`} />
      </Show>
      <Show when={!omit("bottomLeft")}>
        <div class={`absolute bottom-0 left-0 h-px ${w()} ${bg()}`} />
        <div class={`absolute bottom-0 left-0 w-px ${h()} ${bg()}`} />
      </Show>
      <Show when={!omit("bottomRight")}>
        <div class={`absolute right-0 bottom-0 h-px ${w()} ${bg()}`} />
        <div class={`absolute right-0 bottom-0 w-px ${h()} ${bg()}`} />
      </Show>
    </div>
  )
}
