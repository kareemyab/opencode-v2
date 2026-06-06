import { createMemo, createSignal, Show } from "solid-js"
import { StatusBanner } from "./status-banner"

export type StreamBannerStatus = "ready" | "streaming" | "submitted" | "error"

export type StreamBannerProps = {
  status: StreamBannerStatus
  errorMessage?: string | null
  customStatusMessage?: string | null
  onDismiss?: () => void
}

function getStatusMessage(props: {
  status: StreamBannerStatus
  errorMessage?: string | null
  customStatusMessage?: string | null
}): string {
  const errorMessage = props.errorMessage?.trim()
  if (errorMessage) return errorMessage
  if (props.status === "error") return "Error occurred"
  if (props.customStatusMessage?.trim()) return props.customStatusMessage.trim()
  if (props.status === "submitted") return "Processing..."
  if (props.status === "streaming") return "Generating response..."
  if (props.status === "ready") return "Ready"
  return "Setting up..."
}

function isAbortCancellationError(message?: string | null) {
  const normalized = message?.trim().toLowerCase() ?? ""
  return (
    normalized.includes("aborted") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled")
  )
}

export function StreamBanner(props: StreamBannerProps) {
  const [dismissed, setDismissed] = createSignal(false)

  const statusMessage = createMemo(() =>
    getStatusMessage({
      status: props.status,
      errorMessage: props.errorMessage,
      customStatusMessage: props.customStatusMessage,
    }),
  )

  const hasExplicitError = createMemo(() => {
    const message = props.errorMessage?.trim() ?? ""
    return message.length > 0 && !isAbortCancellationError(message)
  })

  const hasError = createMemo(
    () => (props.status === "error" && !isAbortCancellationError(props.errorMessage)) || hasExplicitError(),
  )

  const showLoader = createMemo(
    () => !hasError() && (props.status === "streaming" || props.status === "submitted"),
  )

  const visible = createMemo(() => {
    if (isAbortCancellationError(props.errorMessage)) return false
    if (hasError() && dismissed()) return false
    if (
      !hasError() &&
      props.status === "ready" &&
      !(props.customStatusMessage && props.customStatusMessage.trim().length > 0)
    ) {
      return false
    }
    return true
  })

  const handleDismiss = () => {
    setDismissed(true)
    props.onDismiss?.()
  }

  return (
    <Show when={visible()}>
      <div class="shrink-0 border-b border-border-weak-base" data-slot="stream-banner-divider">
        <StatusBanner
          message={statusMessage()}
          tone={hasError() ? "error" : "default"}
          showLoader={showLoader()}
          onDismiss={hasError() ? handleDismiss : undefined}
        />
      </div>
    </Show>
  )
}
