import { Show, splitProps, type ComponentProps } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"

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
  onStop?: () => void
}) {
  const stopTitle = () => (props.stopping ? "Stopping..." : props.stopLabel)

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
        type="button"
        data-action="prompt-stop"
        data-testid="stop-button"
        disabled={props.stopping}
        title={stopTitle()}
        onClick={(event) => {
          event.preventDefault()
          props.onStop?.()
        }}
        classList={{
          "shrink-0 cursor-pointer rounded-md p-1 transition-colors duration-150 ease-in-out motion-reduce:duration-75 will-change-[opacity,background-color] disabled:cursor-default disabled:opacity-50": true,
          "bg-red-500/10 text-red-400": !!props.stopping,
          "bg-red-500/15 text-red-500 hover:bg-red-500/25": !props.stopping,
          [props.class ?? ""]: !!props.class,
        }}
        aria-label={stopTitle()}
      >
        <div
          classList={{
            "transition-colors duration-100 ease-in-out": true,
            "animate-pulse": !!props.stopping,
          }}
        >
          <Icon
            name="stop"
            class="h-5 w-5 fill-current stroke-current transition-colors duration-100 ease-in-out"
            aria-hidden="true"
          />
        </div>
      </button>
    </Show>
  )
}
