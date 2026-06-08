import { Show } from "solid-js"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"

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
      class="shrink-0 flex items-center gap-1 border-b border-border-weak-base bg-background-base"
      style={{
        "min-height": "47px",
        "padding-left": trafficLightInset(),
        "padding-right": "8px",
      }}
    >
      <Show when={!props.mobile}>
        <TooltipKeybind placement="bottom" title={props.toggleLabel} keybind={props.toggleKeybind}>
          <IconButton
            icon="sidebar"
            variant="ghost"
            class="size-8 shrink-0"
            onClick={props.onToggleSidebar}
            aria-label={props.toggleLabel}
          />
        </TooltipKeybind>
      </Show>
    </div>
  )
}
