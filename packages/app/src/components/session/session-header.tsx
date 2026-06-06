import { createMemo, createSignal, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useSessionLayout } from "@/pages/session/session-layout"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"

export function SessionHeader() {
  const command = useCommand()
  const language = useLanguage()
  const { view } = useSessionLayout()

  const v2ActionsState = createMemo<SessionHeaderV2ActionsState>(() => ({
    reviewLabel: language.t("command.review.toggle"),
    reviewKeybind: command.keybind("review.toggle"),
    reviewOpened: view().reviewPanel.opened(),
    onReviewToggle: () => view().reviewPanel.toggle(),
  }))

  const [rightMount, setRightMount] = createSignal<HTMLElement | null>(null)
  onMount(() => {
    setRightMount(document.getElementById("opencode-titlebar-right"))
  })

  return (
    <Show when={rightMount()}>
      {(mount) => (
        <Portal mount={mount()}>
          <SessionHeaderV2Actions state={v2ActionsState()} />
        </Portal>
      )}
    </Show>
  )
}

type SessionHeaderV2ActionsState = {
  reviewLabel: string
  reviewKeybind: string
  reviewOpened: boolean
  onReviewToggle: () => void
}

function SessionHeaderV2Actions(props: { state: SessionHeaderV2ActionsState }) {
  return (
    <div class="flex h-8 items-start gap-0 p-0 m-0 leading-none">
      <TooltipKeybind title={props.state.reviewLabel} keybind={props.state.reviewKeybind}>
        <IconButtonV2
          type="button"
          variant="ghost-muted"
          size="large"
          class="size-8 min-h-8 min-w-8 shrink-0"
          state={props.state.reviewOpened ? "pressed" : undefined}
          onClick={props.state.onReviewToggle}
          aria-label={props.state.reviewLabel}
          aria-expanded={props.state.reviewOpened}
          aria-controls="review-panel"
          icon={<IconV2 name="sidebar-right" />}
        />
      </TooltipKeybind>
    </div>
  )
}
