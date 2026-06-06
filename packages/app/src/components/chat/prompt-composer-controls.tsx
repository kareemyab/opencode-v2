import { Show, splitProps, type ComponentProps } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"

/** Filled rounded square — matches orgn `message-input-stop-button`. */
function StopSquareIcon(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      stroke-width="2"
      class={props.class ?? "h-5 w-5 fill-current stroke-current"}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  )
}

export function PromptComposerAttachButton(props: ComponentProps<"button"> & { label: string }) {
  const [local, rest] = splitProps(props, ["label", "class", "classList", "children"])
  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      data-action="prompt-attach"
      aria-label={local.label}
      classList={{
        "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-none border-none bg-transparent p-0 text-muted-foreground transition-colors duration-150 hover:bg-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50": true,
        [local.class ?? ""]: !!local.class,
        ...local.classList,
      }}
    >
      {local.children ?? <Icon name="plus" size="small" aria-hidden="true" />}
    </button>
  )
}

export function PromptComposerSubmitButton(props: {
  working: boolean
  shellMode: boolean
  disabled: boolean
  stopping?: boolean
  type?: "button" | "submit"
  sendLabel: string
  stopLabel: string
  class?: string
}) {
  return (
    <Show
      when={props.working && !props.shellMode}
      fallback={
        <button
          type={props.type ?? "submit"}
          data-action="prompt-submit"
          disabled={props.disabled}
          classList={{
            "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-none p-0 bg-primary text-primary-foreground transition-colors duration-150 ease-in-out hover:bg-primary/90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50 motion-reduce:duration-75": true,
            [props.class ?? ""]: !!props.class,
          }}
          aria-label={props.sendLabel}
        >
          <Icon
            name={props.shellMode ? "arrow-undo-down" : "arrow-up"}
            class="size-[18px] text-current"
            aria-hidden="true"
          />
        </button>
      }
    >
      <button
        type={props.type ?? "submit"}
        data-action="prompt-submit"
        disabled={props.stopping}
        classList={{
          "shrink-0 cursor-pointer rounded-md p-1 transition-colors duration-150 ease-in-out motion-reduce:duration-75 will-change-[opacity,background-color] disabled:cursor-default disabled:opacity-50": true,
          "bg-red-500/10 text-red-400": !!props.stopping,
          "bg-red-500/15 text-red-500 hover:bg-red-500/25": !props.stopping,
          [props.class ?? ""]: !!props.class,
        }}
        aria-label={props.stopping ? "Stopping..." : props.stopLabel}
      >
        <div
          classList={{
            "transition-colors duration-100 ease-in-out": true,
            "animate-pulse": !!props.stopping,
          }}
        >
          <StopSquareIcon />
        </div>
      </button>
    </Show>
  )
}
