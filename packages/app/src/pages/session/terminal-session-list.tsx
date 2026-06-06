import { For, Show, createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useLanguage } from "@/context/language"
import { useTerminal, type LocalPTY } from "@/context/terminal"
import { terminalTabLabel } from "@/pages/session/terminal-label"
import { focusTerminalById } from "@/pages/session/helpers"

export function TerminalSessionList(props: {
  sessions: LocalPTY[]
  activeId?: string
  warningKeys: Record<string, boolean>
  onSelect: (id: string) => void
  onPanelClose?: () => void
}) {
  const language = useLanguage()
  const terminal = useTerminal()

  const label = createMemo(
    () => (pty: LocalPTY) =>
      terminalTabLabel({
        title: pty.title,
        titleNumber: pty.titleNumber,
        t: language.t as (key: string, vars?: Record<string, string | number | boolean>) => string,
      }),
  )

  const warningKey = (pty: LocalPTY) => String(pty.titleNumber || pty.title || pty.id)

  const select = (id: string) => {
    props.onSelect(id)
    terminal.open(id)
    focusTerminalById(id)
  }

  const killSession = async (id: string) => {
    const count = terminal.all().length
    await terminal.close(id)
    if (count === 1) props.onPanelClose?.()
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar py-1">
      <For each={props.sessions}>
        {(pty) => (
          <div class="group/session terminal-session-row">
            <button
              type="button"
              class="terminal-session-item"
              data-active={props.activeId === pty.id ? "true" : undefined}
              data-warning={props.warningKeys[warningKey(pty)] ? "true" : undefined}
              onClick={() => select(pty.id)}
            >
              <Icon data-slot="terminal-session-icon" name="terminal" size="small" class="shrink-0" />
              <span class="terminal-session-label min-w-0 flex-1 truncate">{label()(pty)}</span>
              <Show when={props.warningKeys[warningKey(pty)]}>
                <Icon data-slot="terminal-session-warning" name="warning" size="small" class="shrink-0" />
              </Show>
            </button>
            <div class="terminal-session-actions">
              <Tooltip value={language.t("terminal.close")}>
                <button
                  type="button"
                  class="terminal-session-action"
                  aria-label={language.t("terminal.close")}
                  onClick={(event) => {
                    event.stopPropagation()
                    void killSession(pty.id)
                  }}
                >
                  <Icon name="lucide-trash-2" size="small" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
