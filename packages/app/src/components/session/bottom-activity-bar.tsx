import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { Popover } from "@opencode-ai/ui/popover"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { useTheme, type ColorScheme } from "@opencode-ai/ui/theme/context"
import { createMemo, createSignal, For, onMount, Show, Suspense, type JSX } from "solid-js"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { useSessionLayout } from "@/pages/session/session-layout"
import {
  LspStatusPanel,
  McpStatusPanel,
  PluginsStatusPanel,
  ServersDirectoryStatusPanel,
  useDirectoryStatusCounts,
} from "../status-popover-body"
import { TdxSandboxBadge } from "./tdx-sandbox-badge"
import "./bottom-activity-bar.css"

const colorSchemeOrder: ColorScheme[] = ["light", "dark", "system"]

const colorSchemeKey: Record<ColorScheme, "theme.scheme.light" | "theme.scheme.dark" | "theme.scheme.system"> = {
  light: "theme.scheme.light",
  dark: "theme.scheme.dark",
  system: "theme.scheme.system",
}

function ThemeToggleBar() {
  const theme = useTheme()
  const language = useLanguage()

  onMount(() => {
    void theme.loadThemes()
  })

  const paletteOptions = createMemo(() =>
    theme.curatedEntries().map((entry) => ({ key: entry.key, name: entry.label })),
  )

  return (
    <DropdownMenu placement="top-start" gutter={4}>
      <DropdownMenu.Trigger
        class="h-7 max-w-[180px] border-0 bg-transparent shrink-0 text-text-weak hover:bg-surface-raised-base-hover hover:text-text-base flex items-center gap-1.5 px-2 transition-colors"
        aria-label={language.t("bottomActivityBar.theme.trigger")}
      >
        <Icon name="color-palette" size="small" class="shrink-0" />
        <span class="bottom-bar-label truncate">{theme.curatedLabel()}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="min-w-[220px] max-h-[min(420px,70vh)] overflow-y-auto">
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>{language.t("bottomActivityBar.theme.section.scheme")}</DropdownMenu.GroupLabel>
            <For each={colorSchemeOrder}>
              {(scheme) => (
                <DropdownMenu.Item
                  class="flex items-center gap-2"
                  onSelect={() => theme.setColorScheme(scheme)}
                >
                  <span class="flex-1">{language.t(colorSchemeKey[scheme])}</span>
                  <Show when={theme.colorScheme() === scheme}>
                    <Icon name="check" size="small" class="text-icon-weak shrink-0" />
                  </Show>
                </DropdownMenu.Item>
              )}
            </For>
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>{language.t("bottomActivityBar.theme.section.palette")}</DropdownMenu.GroupLabel>
            <For each={paletteOptions()}>
              {(option) => (
                <DropdownMenu.Item
                  class="flex items-center gap-2"
                  onSelect={() => theme.setCuratedTheme(option.key)}
                >
                  <span class="flex-1 truncate">{option.name}</span>
                  <Show when={theme.curatedKey() === option.key}>
                    <Icon name="check" size="small" class="text-icon-weak shrink-0" />
                  </Show>
                </DropdownMenu.Item>
              )}
            </For>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

function BottomBarPopoverItem(props: {
  label: string
  count?: number
  dotClass?: string
  icon?: JSX.Element
  ariaLabel: string
  placement?: "top-start" | "top-end"
  bordered?: boolean
  children: JSX.Element
}) {
  const [open, setOpen] = createSignal(false)

  const bordered = () => props.bordered ?? true

  return (
    <div
      classList={{
        "flex shrink-0 items-center self-stretch": true,
        "border-border-weak-base border-l": bordered(),
      }}
    >
      <Popover
        open={open()}
        onOpenChange={setOpen}
        placement={props.placement ?? "top-end"}
        gutter={6}
        class="[&_[data-slot=popover-body]]:p-0 bg-transparent border-0 shadow-none"
        triggerAs="button"
        triggerProps={{
          type: "button",
          class:
            "flex h-7 cursor-pointer items-center gap-1.5 px-2 text-text-weak text-xs transition-colors hover:bg-surface-raised-base-hover hover:text-text-base",
          "aria-label": props.ariaLabel,
          "aria-expanded": open(),
        }}
        trigger={
          <>
            <Show when={props.dotClass}>
              <div classList={{ "size-1.5 rounded-full shrink-0": true, [props.dotClass!]: true }} />
            </Show>
            {props.icon}
            <span class="bottom-bar-label whitespace-nowrap">
              {props.count !== undefined && props.count > 0 ? `${props.count} ` : ""}
              {props.label}
            </span>
          </>
        }
      >
        <div class="w-[360px] max-w-[calc(100vw-40px)] rounded-xl bg-background-strong shadow-[var(--shadow-lg-border-base)] overflow-hidden">
          <Suspense fallback={<div class="h-14" />}>{props.children}</Suspense>
        </div>
      </Popover>
    </div>
  )
}

function TerminalBarItem() {
  const language = useLanguage()
  const command = useCommand()
  const { view } = useSessionLayout()
  const opened = createMemo(() => view().terminal.opened())

  return (
    <TooltipKeybind
      placement="top"
      title={language.t("command.terminal.toggle")}
      keybind={command.keybind("terminal.toggle")}
    >
      <button
        type="button"
        classList={{
          "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent border-l border-border-weak-base px-2 text-xs transition-colors": true,
          "text-text-base": opened(),
          "text-text-weak hover:bg-surface-raised-base-hover hover:text-text-base": !opened(),
        }}
        aria-label={language.t("command.terminal.toggle")}
        aria-pressed={opened()}
        onClick={() => view().terminal.toggle()}
      >
        <Icon name={opened() ? "terminal-active" : "terminal"} size="small" class="shrink-0" />
        <span class="bottom-bar-label whitespace-nowrap">{language.t("terminal.title")}</span>
      </button>
    </TooltipKeybind>
  )
}

function ServersBarItem() {
  const language = useLanguage()
  const counts = useDirectoryStatusCounts()

  return (
    <BottomBarPopoverItem
      label={language.t("status.popover.tab.servers")}
      count={counts.serverCount()}
      ariaLabel={language.t("status.popover.tab.servers")}
      placement="top-start"
      bordered={false}
    >
      <ServersDirectoryStatusPanel />
    </BottomBarPopoverItem>
  )
}

function StatusBarItems() {
  const language = useLanguage()
  const counts = useDirectoryStatusCounts()

  const mcpDotClass = createMemo(() => {
    if (counts.mcpConnected() === 0) return "bg-border-weak-base"
    if (counts.mcpFailed()) return "bg-icon-critical-base"
    return "bg-icon-success-base"
  })

  return (
    <>
      <BottomBarPopoverItem
        label={language.t("status.popover.tab.mcp")}
        count={counts.mcpConnected()}
        dotClass={mcpDotClass()}
        icon={<Icon name="plug" size="small" class="shrink-0" />}
        ariaLabel={language.t("status.popover.tab.mcp")}
      >
        <McpStatusPanel />
      </BottomBarPopoverItem>

      <BottomBarPopoverItem
        label={language.t("status.popover.tab.lsp")}
        count={counts.lspCount()}
        ariaLabel={language.t("status.popover.tab.lsp")}
      >
        <LspStatusPanel />
      </BottomBarPopoverItem>

      <BottomBarPopoverItem
        label={language.t("status.popover.tab.plugins")}
        count={counts.pluginCount()}
        ariaLabel={language.t("status.popover.tab.plugins")}
      >
        <PluginsStatusPanel />
      </BottomBarPopoverItem>
    </>
  )
}

export function BottomActivityBar() {
  const settings = useSettings()
  const showServers = () => !settings.general.newLayoutDesigns()

  return (
    <div class="bottom-activity-bar relative shrink-0 bg-background-strong">
      <div class="flex h-7 items-center justify-between border-border-weak-base border-t">
        <div class="flex items-center">
          <ThemeToggleBar />
          <Show when={showServers()}>
            <div class="border-border-weak-base flex items-center self-stretch border-l border-r">
              <ServersBarItem />
            </div>
          </Show>
        </div>

        <div class="flex min-w-0 items-center gap-0 overflow-hidden">
          <div class="bottom-bar-tdx-badge border-border-weak-base flex shrink-0 self-stretch border-l">
            <TdxSandboxBadge />
          </div>

          <StatusBarItems />
          <div class="flex shrink-0 items-center self-stretch">
            <TerminalBarItem />
          </div>
        </div>
      </div>
    </div>
  )
}
