import fuzzysort from "fuzzysort"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { Tag } from "@opencode-ai/ui/tag"
import { TextField } from "@opencode-ai/ui/text-field"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { createList } from "solid-list"
import {
  type Component,
  createEffect,
  createMemo,
  For,
  type JSX,
  on,
  Show,
} from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import {
  type CapabilityFilter,
  isMultimodalModel,
  isTeeModel,
  modelKey,
  orderVendors,
  resolveVendor,
  type TeeFilter,
  vendorDisplayLabel,
  vendorIconId,
} from "@/utils/model-selector"
import { ModelTooltip } from "./model-tooltip"

const FILTER_LABELS = {
  tee: {
    all: "TEE: All",
    on: "TEE: On",
    off: "TEE: Off",
  },
  capability: {
    all: "Capability: All",
    multimodal: "Capability: Multimodal",
    textOnly: "Capability: Text",
  },
} as const

const TAG_LABELS = {
  tee: "TEE",
  zdr: "ZDR",
} as const

type ModelItem = {
  id: string
  name: string
  family?: string
  latest?: boolean
  provider: { id: string; name: string }
  cost?: { input: number }
  capabilities?: {
    reasoning?: boolean
    attachment?: boolean
    input?: {
      image?: boolean
      pdf?: boolean
    }
  }
  limit: { context: number }
}

type ModelState = {
  current: () => ModelItem | undefined
  recent: () => Array<ModelItem | undefined>
  list: () => ModelItem[]
  visible: (item: { modelID: string; providerID: string }) => boolean
  set: (item: { modelID: string; providerID: string } | undefined, options?: { recent?: boolean }) => void
}

const isFree = (provider: string, cost: { input: number } | undefined) =>
  provider === "opencode" && (!cost || cost.input === 0)

function cycleTeeFilter(value: TeeFilter): TeeFilter {
  if (value === "all") return "off"
  if (value === "off") return "on"
  return "all"
}

function cycleCapabilityFilter(value: CapabilityFilter): CapabilityFilter {
  if (value === "all") return "multimodal"
  if (value === "multimodal") return "textOnly"
  return "all"
}

function FilterPill(props: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      classList={{
        "h-7 shrink-0 rounded-full border px-3 text-13-medium transition-colors": true,
        "border-border-base bg-surface-raised-base text-text-base": !props.active,
        "border-border-strong-base bg-surface-raised-stronger-non-alpha text-text-strong": props.active,
      }}
    >
      {props.label}
    </button>
  )
}

function ModelRow(props: {
  model: ModelItem
  selected: boolean
  active: boolean
  onSelect: () => void
  onMove: () => void
}) {
  const language = useLanguage()
  const vendor = () => resolveVendor(props.model)
  const tee = () => isTeeModel(props.model)
  const free = () => isFree(props.model.provider.id, props.model.cost)

  return (
    <Tooltip
      class="w-full"
      placement="right-start"
      gutter={12}
      value={
        <ModelTooltip
          model={props.model as Parameters<typeof ModelTooltip>[0]["model"]}
          latest={props.model.latest}
          free={free()}
        />
      }
    >
      <button
        type="button"
        data-slot="model-picker-item"
        data-active={props.active}
        data-selected={props.selected}
        class="flex w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-raised-base-hover data-[active=true]:bg-surface-raised-base-hover"
        onClick={props.onSelect}
        onMouseMove={props.onMove}
      >
        <ProviderIcon id={vendorIconId(vendor())} class="size-5 shrink-0 opacity-70" />
        <span class="min-w-0 flex-1 truncate text-14-regular text-text-base">{props.model.name}</span>
        <div class="flex shrink-0 items-center gap-1">
          <Show when={free()}>
            <Tag class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {language.t("model.tag.free")}
            </Tag>
          </Show>
          <Show when={props.model.latest}>
            <Tag>{language.t("model.tag.latest")}</Tag>
          </Show>
          <Show when={tee()}>
            <Tag class="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400">
              {TAG_LABELS.tee}
            </Tag>
          </Show>
          <Show when={!tee() && !free()}>
            <Tag class="border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">
              {TAG_LABELS.zdr}
            </Tag>
          </Show>
        </div>
      </button>
    </Tooltip>
  )
}

export const ModelPicker: Component<{
  model: ModelState
  provider?: string
  onSelect: () => void
  action?: JSX.Element
  class?: string
}> = (props) => {
  const language = useLanguage()
  const [store, setStore] = createStore({
    query: "",
    teeFilter: "off" as TeeFilter,
    capabilityFilter: "all" as CapabilityFilter,
    expanded: {} as Record<string, boolean>,
  })

  const visibleModels = createMemo(() =>
    props.model
      .list()
      .filter((item) => props.model.visible({ modelID: item.id, providerID: item.provider.id }))
      .filter((item) => (props.provider ? item.provider.id === props.provider : true)),
  )

  const filteredModels = createMemo(() => {
    let items = visibleModels()

    if (store.teeFilter === "on") items = items.filter((item) => isTeeModel(item))
    if (store.teeFilter === "off") items = items.filter((item) => !isTeeModel(item))

    if (store.capabilityFilter === "multimodal") {
      items = items.filter((item) => isMultimodalModel(item))
    }
    if (store.capabilityFilter === "textOnly") {
      items = items.filter((item) => !isMultimodalModel(item))
    }

    const query = store.query.trim()
    if (!query) return items
    if (query.length < 2) {
      const needle = query.toLowerCase()
      return items.filter((item) => `${resolveVendor(item)} ${item.name} ${item.id}`.toLowerCase().includes(needle))
    }

    const matches = fuzzysort.go(query, items, {
      keys: ["name", "id", (item) => resolveVendor(item), (item) => item.provider.name],
      threshold: -10000,
    })
    const matched = new Set(matches.map((match) => modelKey(match.obj)))
    return items.filter((item) => matched.has(modelKey(item)))
  })

  const promoted = createMemo(() => {
    const placed = new Set<string>()
    const items: ModelItem[] = []
    const add = (item: ModelItem | undefined) => {
      if (!item) return
      const key = modelKey(item)
      if (placed.has(key)) return
      if (!filteredModels().some((entry) => modelKey(entry) === key)) return
      placed.add(key)
      items.push(item)
    }

    add(props.model.current())
    for (const item of props.model.recent()) add(item)

    return { items, placed }
  })

  const vendorSections = createMemo(() => {
    const remaining = filteredModels().filter((item) => !promoted().placed.has(modelKey(item)))
    const byVendor = new Map<string, ModelItem[]>()

    for (const item of remaining) {
      const vendor = resolveVendor(item)
      const bucket = byVendor.get(vendor) ?? []
      bucket.push(item)
      byVendor.set(vendor, bucket)
    }

    return orderVendors(byVendor.keys()).map((vendor) => ({
      vendor,
      label: vendorDisplayLabel(vendor),
      items: (byVendor.get(vendor) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
  })

  const isExpanded = (vendor: string) => store.expanded[vendor] ?? false

  const flat = createMemo(() => [
    ...promoted().items,
    ...vendorSections().flatMap((section) => (isExpanded(section.vendor) ? section.items : [])),
  ])

  const initialActive = () => {
    const current = props.model.current()
    if (current) return modelKey(current)
    const first = flat()[0]
    return first ? modelKey(first) : ""
  }

  const list = createList({
    items: () => flat().map(modelKey),
    initialActive: initialActive(),
    loop: true,
  })

  createEffect(
    on(
      () => [store.query, store.teeFilter, store.capabilityFilter, flat().length] as const,
      () => {
        const current = props.model.current()
        if (current && flat().some((item) => modelKey(item) === modelKey(current))) {
          list.setActive(modelKey(current))
          return
        }
        const first = flat()[0]
        list.setActive(first ? modelKey(first) : "")
      },
    ),
  )

  createEffect(() => {
    const current = props.model.current()
    if (!current || store.query) return
    const vendor = resolveVendor(current)
    if (store.expanded[vendor] !== undefined) return
    setStore("expanded", vendor, true)
  })

  createEffect(
    on(
      () => store.query,
      (query) => {
        if (!query.trim()) return
        const next: Record<string, boolean> = { ...store.expanded }
        for (const section of vendorSections()) {
          if (section.items.length > 0) next[section.vendor] = true
        }
        setStore("expanded", next)
      },
    ),
  )

  const teeLabel = () => FILTER_LABELS.tee[store.teeFilter]

  const capabilityLabel = () => FILTER_LABELS.capability[store.capabilityFilter]

  const select = (item: ModelItem) => {
    props.model.set({ modelID: item.id, providerID: item.provider.id }, { recent: true })
    props.onSelect()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault()
      const active = flat().find((item) => modelKey(item) === list.active())
      if (active) select(active)
      return
    }
    if (event.altKey || event.metaKey) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      list.onKeyDown(event)
    }
  }

  return (
    <div
      data-component="model-picker"
      classList={{
        "flex min-h-0 flex-1 flex-col gap-3": true,
        [props.class ?? ""]: !!props.class,
      }}
    >
      <div class="flex shrink-0 items-center gap-2 px-0.5">
        <FilterPill
          label={teeLabel()}
          active={store.teeFilter !== "all"}
          onClick={() => setStore("teeFilter", cycleTeeFilter(store.teeFilter))}
        />
        <FilterPill
          label={capabilityLabel()}
          active={store.capabilityFilter !== "all"}
          onClick={() => setStore("capabilityFilter", cycleCapabilityFilter(store.capabilityFilter))}
        />
      </div>

      <div class="flex shrink-0 items-center gap-2 border-b border-border-weak-base px-0.5 pb-3">
        <div class="flex min-h-9 min-w-0 flex-1 items-center rounded-md bg-surface-base px-3">
          <TextField
            autofocus
            variant="ghost"
            type="text"
            class="w-full"
            value={store.query}
            onChange={(value) => setStore("query", value)}
            onKeyDown={handleKeyDown}
            placeholder={language.t("dialog.model.search.placeholder")}
            spellcheck={false}
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
          />
        </div>
        {props.action}
      </div>

      <div
        data-slot="model-picker-scroll"
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-2"
        onKeyDown={handleKeyDown}
      >
        <Show
          when={flat().length > 0}
          fallback={<div class="px-2 py-10 text-center text-14-regular text-text-weak">{language.t("dialog.model.empty")}</div>}
        >
          <Show when={promoted().items.length > 0}>
            <div class="flex flex-col gap-1 pb-2">
              <For each={promoted().items}>
                {(item) => (
                  <ModelRow
                    model={item}
                    selected={props.model.current()?.id === item.id && props.model.current()?.provider.id === item.provider.id}
                    active={list.active() === modelKey(item)}
                    onSelect={() => select(item)}
                    onMove={() => list.setActive(modelKey(item))}
                  />
                )}
              </For>
            </div>
          </Show>

          <For each={vendorSections()}>
            {(section) => (
              <Show when={section.items.length > 0}>
                <Collapsible
                  open={isExpanded(section.vendor)}
                  onOpenChange={(open) => setStore("expanded", section.vendor, open)}
                  class="border-t border-border-weak-base first:border-t-0"
                >
                  <Collapsible.Trigger class="flex w-full items-center gap-2 px-1 py-2.5 text-left">
                    <span
                      class="inline-flex size-4 shrink-0 items-center justify-center text-icon-base transition-transform duration-150"
                      classList={{ "rotate-[-90deg]": !isExpanded(section.vendor) }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                          d="M4.5 2.5L8 6L4.5 9.5"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </span>
                    <span class="min-w-0 flex-1 truncate text-14-medium text-text-base">{section.label}</span>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <div class="flex flex-col gap-1 pb-2">
                      <For each={section.items}>
                        {(item) => (
                          <ModelRow
                            model={item}
                            selected={
                              props.model.current()?.id === item.id &&
                              props.model.current()?.provider.id === item.provider.id
                            }
                            active={list.active() === modelKey(item)}
                            onSelect={() => select(item)}
                            onMove={() => list.setActive(modelKey(item))}
                          />
                        )}
                      </For>
                    </div>
                  </Collapsible.Content>
                </Collapsible>
              </Show>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
