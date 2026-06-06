import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { Popover } from "@opencode-ai/ui/popover"
import { useTheme, type ColorScheme } from "@opencode-ai/ui/theme/context"
import { createMemo, createSignal, For, Show, Suspense, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
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

  return (
    <DropdownMenu placement="top-start" gutter={4}>
      <DropdownMenu.Trigger
        class="size-7 border-0 bg-transparent shrink-0 text-text-weak hover:bg-surface-raised-base-hover hover:text-text-base flex items-center justify-center transition-colors"
        aria-label={language.t("bottomActivityBar.theme.trigger")}
      >
        <Icon name="color-switch" size="small" />
        <span class="sr-only">{language.t("bottomActivityBar.theme.trigger")}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="min-w-[160px]">
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
        </div>
      </div>
    </div>
  )
}
