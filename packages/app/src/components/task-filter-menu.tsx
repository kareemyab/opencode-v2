import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { For, Show } from "solid-js"

export type FilterOption = { value: string; label: string; color?: string | null }
export type FilterSection = {
  label: string
  options: FilterOption[]
  isSelected: (value: string) => boolean
  toggle: (value: string) => void
}

/**
 * Preferences/filter dropdown for the task list. Each section (status, priority, assignee, label)
 * is a multi-select list of checkable items; clicking toggles without closing the menu.
 */
export function TaskFilterMenu(props: { count: number; sections: FilterSection[]; onClear: () => void }) {
  return (
    <DropdownMenu placement="bottom-end" gutter={6}>
      <DropdownMenu.Trigger
        classList={{
          "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none data-[expanded]:bg-surface-base-active":
            true,
          "text-text-strong": props.count > 0,
          "text-icon-weak-base hover:text-icon-base": props.count === 0,
        }}
        aria-label="Filter tasks"
      >
        <Icon name="sliders" class="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="z-50 max-h-[440px] min-w-[224px] overflow-y-auto">
          <For each={props.sections}>
            {(section, i) => (
              <>
                <Show when={i() > 0}>
                  <DropdownMenu.Separator />
                </Show>
                <div class="px-2 pb-1 pt-1.5 text-12-mono tracking-[0.1em] text-text-weak">{section.label}</div>
                <Show
                  when={section.options.length}
                  fallback={<div class="px-2 py-1 text-12-regular text-text-weak">None</div>}
                >
                  <For each={section.options}>
                    {(opt) => (
                      <DropdownMenu.Item
                        class="flex items-center gap-2"
                        closeOnSelect={false}
                        onSelect={() => section.toggle(opt.value)}
                      >
                        <Show when={opt.color}>
                          <span class="size-2.5 shrink-0 rounded-full" style={{ "background-color": opt.color! }} />
                        </Show>
                        <DropdownMenu.ItemLabel class="min-w-0 flex-1 truncate">{opt.label}</DropdownMenu.ItemLabel>
                        <Show when={section.isSelected(opt.value)}>
                          <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
                        </Show>
                      </DropdownMenu.Item>
                    )}
                  </For>
                </Show>
              </>
            )}
          </For>
          <Show when={props.count > 0}>
            <DropdownMenu.Separator />
            <DropdownMenu.Item class="flex items-center gap-2" onSelect={() => props.onClear()}>
              <DropdownMenu.ItemLabel class="text-text-weak">Clear filters</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </Show>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
