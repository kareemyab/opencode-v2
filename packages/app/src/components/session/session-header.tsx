import { createMemo, createSignal, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSessionLayout } from "@/pages/session/session-layout"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"

export function SessionHeader() {
  const command = useCommand()
  const language = useLanguage()
  const layout = useLayout()
  const { view } = useSessionLayout()

  const actionsState = createMemo<SessionHeaderActionsState>(() => ({
    reviewLabel: language.t("command.review.toggle"),
    reviewKeybind: command.keybind("review.toggle"),
    reviewOpened: view().reviewPanel.opened(),
    onReviewToggle: () => view().reviewPanel.toggle(),
    terminalLabel: language.t("command.terminal.toggle"),
    terminalKeybind: command.keybind("terminal.toggle"),
    terminalOpened: view().terminal.opened(),
    onTerminalToggle: () => view().terminal.toggle(),
    collapseLabel: "Collapse panels — focus chat",
    // Collapse everything (left sidebar + right panel + terminal) → only the chat remains.
    onCollapseAll: () => {
      layout.sidebar.close()
      view().reviewPanel.close()
      view().terminal.close()
    },
  }))

  const [rightMount, setRightMount] = createSignal<HTMLElement | null>(null)
  onMount(() => {
    setRightMount(document.getElementById("orgn-titlebar-actions"))
  })

  return (
    <Show when={rightMount()}>
      {(mount) => (
        <Portal mount={mount()}>
          <SessionHeaderActions state={actionsState()} />
        </Portal>
      )}
    </Show>
  )
}

type SessionHeaderActionsState = {
  reviewLabel: string
  reviewKeybind: string
  reviewOpened: boolean
  onReviewToggle: () => void
  terminalLabel: string
  terminalKeybind: string
  terminalOpened: boolean
  onTerminalToggle: () => void
  collapseLabel: string
  onCollapseAll: () => void
}

function SessionHeaderActions(props: { state: SessionHeaderActionsState }) {
  const s = () => props.state
  return (
    <div class="flex items-center gap-1">
      <TooltipKeybind title={s().reviewLabel} keybind={s().reviewKeybind}>
        <IconButton
          icon="sidebar-right"
          variant="ghost"
          class="size-8 shrink-0"
          classList={{ "bg-surface-raised-base text-text-strong": s().reviewOpened }}
          onClick={() => s().onReviewToggle()}
          aria-label={s().reviewLabel}
          aria-controls="review-panel"
        />
      </TooltipKeybind>
      <TooltipKeybind title={s().terminalLabel} keybind={s().terminalKeybind}>
        <IconButton
          icon="terminal"
          variant="ghost"
          class="size-8 shrink-0"
          classList={{ "bg-surface-raised-base text-text-strong": s().terminalOpened }}
          onClick={() => s().onTerminalToggle()}
          aria-label={s().terminalLabel}
        />
      </TooltipKeybind>
      <Tooltip value={s().collapseLabel}>
        <IconButton
          icon="collapse"
          variant="ghost"
          class="size-8 shrink-0"
          onClick={() => s().onCollapseAll()}
          aria-label={s().collapseLabel}
        />
      </Tooltip>
    </div>
  )
}
