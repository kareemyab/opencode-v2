import { Show } from "solid-js"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { Mark } from "@opencode-ai/ui/logo"

/** Top chrome for the unified sidebar column (traffic-light inset + sidebar toggle). */
export function SidebarChromeHeader(props: {
  mac: boolean
  zoom: number
  onToggleSidebar: () => void
  toggleLabel: string
  toggleKeybind: string
  mobile?: boolean
}) {
  const trafficLightInset = () => (props.mac ? `${84 / props.zoom}px` : undefined)

  return (
    <div
      data-component="sidebar-chrome"
      class="relative shrink-0 flex items-center gap-1 border-b border-border-weak-base bg-background-base [app-region:drag]"
      style={{
        "min-height": "47px",
        "padding-left": trafficLightInset(),
        "padding-right": "8px",
      }}
    >
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Mark class="h-3 w-auto text-text-strong opacity-60" />
      </div>
      <Show when={!props.mobile}>
        <TooltipKeybind placement="bottom" title={props.toggleLabel} keybind={props.toggleKeybind}>
          <IconButton
            icon="sidebar"
            variant="ghost"
            class="size-8 shrink-0 [app-region:no-drag]"
            onClick={props.onToggleSidebar}
            aria-label={props.toggleLabel}
          />
        </TooltipKeybind>
      </Show>
      {/* Right-aligned actions mount — the session view portals its panel/terminal toggles here.
          Unique id (NOT the Titlebar's #opencode-titlebar-right, which a hidden mobile Titlebar also
          renders) so the portal lands in THIS visible top bar. Desktop-only to avoid a duplicate id. */}
      <Show when={!props.mobile}>
        <div id="orgn-titlebar-actions" class="ml-auto flex items-center gap-1 [app-region:no-drag]" />
      </Show>
    </div>
  )
}
