import { Show } from "solid-js"
import { TextShimmer } from "@opencode-ai/ui/text-shimmer"
import { Icon } from "@opencode-ai/ui/icon"
import { TokenStream } from "./token-stream"
import "./stream-banner.css"

export type StatusBannerProps = {
  message: string
  tone?: "default" | "error"
  showLoader?: boolean
  onDismiss?: () => void
  class?: string
}

export function StatusBanner(props: StatusBannerProps) {
  const isError = () => (props.tone ?? "default") === "error"

  return (
    <div
      classList={{
        "group relative flex h-8 w-full cursor-default items-center justify-between overflow-hidden font-mono leading-normal selection:text-gray-300": true,
        "bg-destructive text-destructive-foreground": isError(),
        "bg-muted text-muted-foreground": !isError(),
        [props.class ?? ""]: !!props.class,
      }}
      role={isError() ? "alert" : "status"}
      aria-live={isError() ? "assertive" : "polite"}
      data-testid="stream-banner"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <Show when={!isError()}>
          <div class="stream-banner-shimmer absolute inset-0 animate-shimmer opacity-70" />
        </Show>
      </div>

      <div class="relative z-10 flex flex-1 items-center justify-between">
        <div class="flex items-center gap-2 pl-4">
          <Show when={props.showLoader && !isError()}>
            <span aria-hidden="true" class="shrink-0">
              <TokenStream speed={2} dotSize={1.8} cellPadding={0.25} />
            </span>
          </Show>

          <Show
            when={isError()}
            fallback={
              <TextShimmer text={props.message} class="text-sm font-medium" active />
            }
          >
            <span class="text-sm font-medium">{props.message}</span>
          </Show>
        </div>
      </div>

      <Show when={isError() && props.onDismiss}>
        <button
          type="button"
          onClick={() => props.onDismiss?.()}
          class="relative z-10 mr-2 shrink-0 cursor-pointer p-1 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-1"
          aria-label="Dismiss status"
        >
          <Icon name="close" size="small" aria-hidden="true" />
        </button>
      </Show>
    </div>
  )
}
