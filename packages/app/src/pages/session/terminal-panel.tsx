import { Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { Terminal } from "@/components/terminal"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useTerminal } from "@/context/terminal"
import { createSizing, focusTerminalById } from "@/pages/session/helpers"
import { setTerminalHandoff } from "@/pages/session/handoff"
import { useSessionLayout } from "@/pages/session/session-layout"
import { terminalTabLabel } from "@/pages/session/terminal-label"
import { TerminalSessionList } from "@/pages/session/terminal-session-list"
import "./terminal-panel.css"

export function TerminalPanel() {
  const delays = [120, 240]
  const layout = useLayout()
  const terminal = useTerminal()
  const language = useLanguage()
  const command = useCommand()
  const { params, workspaceKey, view } = useSessionLayout()

  const opened = createMemo(() => view().terminal.opened())
  const size = createSizing()
  const height = createMemo(() => layout.terminal.height())
  const close = () => view().terminal.close()
  let root: HTMLDivElement | undefined

  const [maximized, setMaximized] = createSignal(false)
  const [savedHeight, setSavedHeight] = createSignal<number | null>(null)

  const [store, setStore] = createStore({
    autoCreated: false,
    recovered: {} as Record<string, boolean>,
    view: typeof window === "undefined" ? 1000 : (window.visualViewport?.height ?? window.innerHeight),
  })

  const max = () => store.view * 0.6
  const pane = () => Math.min(height(), max())

  onMount(() => {
    if (typeof window === "undefined") return

    const sync = () => setStore("view", window.visualViewport?.height ?? window.innerHeight)
    const port = window.visualViewport

    sync()
    makeEventListener(window, "resize", sync)
    if (port) makeEventListener(port, "resize", sync)
  })

  createEffect(() => {
    if (!opened()) {
      setStore("autoCreated", false)
      setMaximized(false)
      setSavedHeight(null)
      return
    }

    if (!terminal.ready() || terminal.all().length !== 0 || store.autoCreated) return
    terminal.new()
    setStore("autoCreated", true)
  })

  createEffect(
    on(
      () => terminal.all().length,
      (count, prevCount) => {
        if (prevCount === undefined || prevCount <= 0 || count !== 0) return
        if (!opened()) return
        close()
      },
    ),
  )

  const focus = (id: string) => {
    focusTerminalById(id)

    const frame = requestAnimationFrame(() => {
      if (!opened()) return
      if (terminal.active() !== id) return
      focusTerminalById(id)
    })

    const timers = delays.map((ms) =>
      window.setTimeout(() => {
        if (!opened()) return
        if (terminal.active() !== id) return
        focusTerminalById(id)
      }, ms),
    )

    return () => {
      cancelAnimationFrame(frame)
      for (const timer of timers) clearTimeout(timer)
    }
  }

  createEffect(
    on(
      () => [opened(), terminal.active()] as const,
      ([next, id]) => {
        if (!next || !id) return
        const stop = focus(id)
        onCleanup(stop)
      },
    ),
  )

  createEffect(() => {
    if (opened()) return
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return
    if (!root?.contains(active)) return
    active.blur()
  })

  createEffect(() => {
    const dir = params.dir
    if (!dir) return
    if (!terminal.ready()) return
    language.locale()

    setTerminalHandoff(
      workspaceKey(),
      terminal.all().map((pty) =>
        terminalTabLabel({
          title: pty.title,
          titleNumber: pty.titleNumber,
          t: language.t as (key: string, vars?: Record<string, string | number | boolean>) => string,
        }),
      ),
    )
  })

  const all = terminal.all

  const recoverTerminal = (key: string, id: string, clone: (id: string) => Promise<void>) => {
    if (store.recovered[key]) return
    setStore("recovered", key, true)
    void clone(id)
  }

  const terminalRecoveryKey = (pty: { id: string; title: string; titleNumber: number }) => {
    return String(pty.titleNumber || pty.title || pty.id)
  }

  const markTerminalConnected = (key: string, id: string, trim: (id: string) => void) => {
    setStore("recovered", key, false)
    trim(id)
  }

  const toggleMaximize = () => {
    if (maximized()) {
      layout.terminal.resize(savedHeight() ?? 280)
      setMaximized(false)
      setSavedHeight(null)
      return
    }

    setSavedHeight(height())
    layout.terminal.resize(max())
    setMaximized(true)
  }

  return (
    <div
      ref={root}
      id="terminal-panel"
      data-security
      data-component="terminal-panel"
      role="region"
      aria-label={language.t("terminal.title")}
      aria-hidden={!opened()}
      inert={!opened()}
      class="relative w-full shrink-0 overflow-hidden"
      classList={{
        "border-t border-[var(--terminal-border)]": opened(),
        "transition-[height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[height] motion-reduce:transition-none":
          !size.active(),
      }}
      style={{ height: opened() ? `${pane()}px` : "0px" }}
    >
      <div
        class="absolute inset-x-0 top-0 flex flex-col"
        classList={{
          "pointer-events-none": !opened(),
        }}
        style={{ height: `${pane()}px` }}
      >
        <div class="hidden md:block" onPointerDown={() => size.start()}>
          <ResizeHandle
            direction="vertical"
            size={pane()}
            min={100}
            max={max()}
            collapseThreshold={50}
            onResize={(next) => {
              size.touch()
              layout.terminal.resize(next)
              if (maximized()) {
                setMaximized(false)
                setSavedHeight(null)
              }
            }}
            onCollapse={close}
          />
        </div>
        <Show
          when={terminal.ready()}
          fallback={
            <div class="terminal-panel-loading flex h-full items-center justify-center pointer-events-none">
              {language.t("terminal.loading")}
            </div>
          }
        >
          <div class="terminal-panel-body flex h-full min-h-0 flex-1">
              <div class="terminal-panel-main relative min-h-0 flex-1">
                <Show when={terminal.active()} keyed>
                  {(id) => {
                    const ops = terminal.bind()
                    return (
                      <Show when={all().find((pty) => pty.id === id)}>
                        {(pty) => (
                          <div id={`terminal-wrapper-${id}`} class="absolute inset-0">
                            <Terminal
                              pty={pty()}
                              autoFocus={opened()}
                              class="!px-3 !py-2"
                              onConnect={() => markTerminalConnected(terminalRecoveryKey(pty()), id, ops.trim)}
                              onCleanup={ops.update}
                              onConnectError={() => recoverTerminal(terminalRecoveryKey(pty()), id, ops.clone)}
                            />
                          </div>
                        )}
                      </Show>
                    )
                  }}
                </Show>
              </div>

              <div class="terminal-panel-sidebar flex min-h-0 flex-col">
                <div class="terminal-panel-toolbar flex shrink-0 items-center justify-end gap-0.5">
                  <TooltipKeybind
                    title={language.t("command.terminal.new")}
                    keybind={command.keybind("terminal.new")}
                  >
                    <IconButton
                      icon="lucide-plus"
                      variant="ghost"
                      class="terminal-panel-action"
                      onClick={terminal.new}
                      aria-label={language.t("command.terminal.new")}
                    />
                  </TooltipKeybind>
                  <Tooltip
                    value={maximized() ? language.t("terminal.panel.restore") : language.t("terminal.panel.maximize")}
                  >
                    <IconButton
                      icon={maximized() ? "lucide-chevron-down" : "lucide-chevron-up"}
                      variant="ghost"
                      class="terminal-panel-action"
                      onClick={toggleMaximize}
                      aria-label={
                        maximized() ? language.t("terminal.panel.restore") : language.t("terminal.panel.maximize")
                      }
                    />
                  </Tooltip>
                  <Tooltip value={language.t("command.terminal.toggle")}>
                    <IconButton
                      icon="lucide-x"
                      variant="ghost"
                      class="terminal-panel-action"
                      onClick={close}
                      aria-label={language.t("command.terminal.toggle")}
                    />
                  </Tooltip>
                </div>
                <TerminalSessionList
                  sessions={all()}
                  activeId={terminal.active()}
                  warningKeys={store.recovered}
                  onSelect={(id) => terminal.open(id)}
                  onPanelClose={close}
                />
              </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
