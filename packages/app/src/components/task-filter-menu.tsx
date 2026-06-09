import { Avatar } from "@opencode-ai/ui/avatar"
import { Icon } from "@opencode-ai/ui/icon"
import { Popover } from "@opencode-ai/ui/popover"
import { createEffect, createSignal, For, on, Show } from "solid-js"

export type FilterOption = { value: string; label: string; color?: string | null; avatar?: string }
export type FilterSection = {
  label: string
  key?: string
  /** "chips" → compact colored toggle-chips (Status/Priority); "list" → searchable rows (Assignee/Label). */
  variant?: "chips" | "list"
  options: FilterOption[]
  /** Reactive count of selected values in this dimension (getter so it stays live). */
  selectedCount?: () => number
  isSelected: (value: string) => boolean
  toggle: (value: string) => void
}

/**
 * Task filter dropdown — a two-pane master/detail Popover. A fixed left rail lists the filter
 * dimensions (Status, Priority, Assignee, Label), each with a live selected-count; the right pane
 * shows only the active dimension's values, so the height stays bounded no matter how many statuses
 * or labels exist. Status/Priority render as compact colored toggle-chips; Assignee/Label as a
 * searchable list (the search box appears once a list grows past 8 entries). Toggling never closes
 * the menu, and a footer summarizes the active filters with a Clear-all.
 */
export function TaskFilterMenu(props: { count: number; sections: FilterSection[]; onClear: () => void }) {
  const [active, setActive] = createSignal(0)
  const [query, setQuery] = createSignal("")

  // On open, jump to the first dimension that already has a selection (else Status).
  const seed = () => {
    const idx = props.sections.findIndex((s) => (s.selectedCount?.() ?? 0) > 0)
    setActive(idx >= 0 ? idx : 0)
  }
  // Reset the search box whenever the active dimension changes.
  createEffect(on(active, () => setQuery("")))

  const current = () => props.sections[active()] as FilterSection | undefined
  const filtered = () => {
    const sec = current()
    if (!sec) return []
    const q = query().trim().toLowerCase()
    return q ? sec.options.filter((o) => o.label.toLowerCase().includes(q)) : sec.options
  }

  return (
    <Popover
      placement="bottom-end"
      gutter={6}
      triggerAs="button"
      trigger={<Icon name="sliders" class="size-4" />}
      triggerProps={{
        type: "button",
        "aria-label": "Filter tasks",
        classList: {
          "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none data-[expanded]:bg-surface-base-active":
            true,
          "text-text-strong": props.count > 0,
          "text-icon-weak-base hover:text-icon-base": props.count === 0,
        },
      }}
      onOpenChange={(open) => open && seed()}
      class="z-50 overflow-hidden"
      style={{ width: "396px", "max-width": "396px" }}
    >
      {/* -m-3 cancels the popover body's 12px padding so the two panes sit flush to the edges. */}
      <div class="-m-3 flex flex-col">
        <div class="flex h-[300px]">
          {/* Left rail — the filter dimensions */}
          <div class="flex w-[128px] shrink-0 flex-col border-r border-border-weak-base py-1">
            <For each={props.sections}>
              {(section, i) => (
                <button
                  type="button"
                  onClick={() => setActive(i())}
                  classList={{
                    "relative flex items-center gap-2 px-2.5 py-1.5 text-left text-13-regular transition-colors": true,
                    "bg-surface-base-active text-text-strong": active() === i(),
                    "text-text-weak hover:bg-surface-raised-base-hover hover:text-text-base": active() !== i(),
                  }}
                >
                  <Show when={active() === i()}>
                    <span class="absolute left-0 top-0 h-full w-0.5 bg-text-strong" />
                  </Show>
                  <span class="min-w-0 flex-1 truncate capitalize">{section.label.toLowerCase()}</span>
                  <Show when={(section.selectedCount?.() ?? 0) > 0}>
                    <span class="shrink-0 text-12-mono tabular-nums text-text-weak">{section.selectedCount!()}</span>
                  </Show>
                </button>
              )}
            </For>
          </div>

          {/* Right pane — the active dimension's values */}
          <div class="flex min-w-0 flex-1 flex-col">
            <Show when={current()} fallback={<div class="px-2.5 py-2 text-12-regular text-text-weak">No filters</div>}>
              <Show
                when={current()!.variant === "chips"}
                fallback={
                  <>
                    {/* Searchable list (Assignee / Label) */}
                    <Show when={current()!.options.length > 8}>
                      <div class="flex items-center gap-1.5 border-b border-border-weak-base px-2.5 py-2">
                        <Icon name="magnifying-glass" class="size-3.5 shrink-0 text-icon-weak-base" />
                        <input
                          type="text"
                          autofocus
                          value={query()}
                          onInput={(e) => setQuery(e.currentTarget.value)}
                          placeholder="Search…"
                          class="min-w-0 flex-1 bg-transparent text-13-regular text-text-base placeholder:text-text-weak focus:outline-none"
                        />
                      </div>
                    </Show>
                    <div class="min-h-0 flex-1 overflow-y-auto py-1">
                      <For
                        each={filtered()}
                        fallback={<div class="px-2.5 py-1.5 text-12-regular text-text-weak">No matches</div>}
                      >
                        {(opt) => (
                          <button
                            type="button"
                            onClick={() => current()!.toggle(opt.value)}
                            class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-raised-base-hover"
                          >
                            <Show
                              when={opt.avatar !== undefined}
                              fallback={
                                <Show when={opt.color} fallback={<span class="size-2.5 shrink-0" />}>
                                  <span
                                    class="size-2.5 shrink-0 rounded-full"
                                    style={{ "background-color": opt.color! }}
                                  />
                                </Show>
                              }
                            >
                              <Avatar size="small" fallback={opt.label} src={opt.avatar || undefined} />
                            </Show>
                            <span class="min-w-0 flex-1 truncate text-13-regular text-text-base">{opt.label}</span>
                            <Show when={current()!.isSelected(opt.value)}>
                              <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
                            </Show>
                          </button>
                        )}
                      </For>
                    </div>
                  </>
                }
              >
                {/* Chip grid (Status / Priority) */}
                <div class="flex flex-1 flex-wrap content-start gap-1.5 overflow-y-auto p-2.5">
                  <For each={current()!.options} fallback={<div class="text-12-regular text-text-weak">None</div>}>
                    {(opt) => {
                      const selected = () => current()!.isSelected(opt.value)
                      return (
                        <button
                          type="button"
                          aria-pressed={selected()}
                          onClick={() => current()!.toggle(opt.value)}
                          classList={{
                            "inline-flex h-7 items-center gap-1.5 border px-2 text-12-medium transition-colors focus-visible:outline-none":
                              true,
                            "border-border-weak-base bg-surface-base-active text-text-strong": selected(),
                            "border-border-weak-base text-text-weak hover:bg-surface-raised-base-hover hover:text-text-base":
                              !selected(),
                          }}
                        >
                          <Show when={opt.color}>
                            <span
                              class="size-2 shrink-0 rounded-full"
                              classList={{ "opacity-40": !selected() }}
                              style={{ "background-color": opt.color! }}
                            />
                          </Show>
                          <span class="whitespace-nowrap capitalize">{opt.label}</span>
                        </button>
                      )
                    }}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
        </div>

        {/* Footer — active filter count + clear */}
        <Show when={props.count > 0}>
          <div class="flex items-center justify-between border-t border-border-weak-base px-2.5 py-1.5">
            <span class="text-12-mono tabular-nums text-text-weak">
              {props.count} {props.count === 1 ? "filter" : "filters"}
            </span>
            <button
              type="button"
              onClick={() => props.onClear()}
              class="text-12-medium text-text-weak hover:text-text-strong"
            >
              Clear all
            </button>
          </div>
        </Show>
      </div>
    </Popover>
  )
}
