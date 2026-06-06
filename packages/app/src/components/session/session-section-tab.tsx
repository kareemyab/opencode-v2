import { Show, type Accessor, type JSX } from "solid-js"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Tooltip } from "@opencode-ai/ui/tooltip"

type IconName = IconProps["name"]

export function SessionSectionTabTrigger(props: {
  value: string
  label: string
  icon: IconName
  activeIcon?: IconName
  selected?: Accessor<boolean>
  badge?: Accessor<number | undefined>
  children?: JSX.Element
}) {
  const icon = () => {
    if (props.selected?.() && props.activeIcon) return props.activeIcon
    return props.icon
  }

  return (
    <Tooltip value={props.label} placement="bottom">
      <Tabs.Trigger
        value={props.value}
        class="session-section-tab"
        classes={{ button: "session-section-tab__button" }}
        aria-label={props.label}
      >
        <Show when={props.children} fallback={<Icon name={icon()} size="normal" class="size-[18px] shrink-0" />}>
          {props.children}
        </Show>
        <Show when={props.badge?.()}>
          {(count) => (
            <span class="session-section-tab__badge" aria-hidden="true">
              {count()}
            </span>
          )}
        </Show>
      </Tabs.Trigger>
    </Tooltip>
  )
}
