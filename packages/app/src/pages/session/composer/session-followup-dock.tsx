import { Index, createEffect, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { AnimatedNumber } from "@opencode-ai/ui/animated-number"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { DockTray } from "@opencode-ai/ui/dock-surface"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useSpring } from "@opencode-ai/ui/motion-spring"
import { TextReveal } from "@opencode-ai/ui/text-reveal"
import { useLanguage } from "@/context/language"

const queuedToken = "\u0000queued\u0000"
const totalToken = "\u0000total\u0000"

export function SessionFollowupDock(props: {
  items: { id: string; text: string }[]
  sending?: string
  onSend: (id: string) => void
  onEdit: (id: string) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    collapsed: false,
    height: 320,
    header: 32,
  })

  const toggle = () => setStore("collapsed", (value) => !value)
  const total = createMemo(() => props.items.length)
  const queued = createMemo(() => props.items.filter((item) => item.id !== props.sending).length)
  const label = createMemo(() => language.t("session.followup.progress", { queued: queued(), total: total() }))
  const progress = createMemo(() =>
    language
      .t("session.followup.progress", { queued: queuedToken, total: totalToken })
      .split(/(\u0000queued\u0000|\u0000total\u0000)/),
  )
  const preview = createMemo(() => props.items[0]?.text ?? "")
  const collapse = useSpring(() => (store.collapsed ? 1 : 0), { visualDuration: 0.3, bounce: 0 })
  const value = createMemo(() => Math.max(0, Math.min(1, collapse())))
  const turn = createMemo(() => Math.max(0, Math.min(1, value())))
  const min = createMemo(() => Math.max(1, store.header))
  const full = createMemo(() => Math.max(min(), store.height))
  let headerRef: HTMLDivElement | undefined
  let contentRef: HTMLDivElement | undefined

  createEffect(() => {
    const el = headerRef
    if (!el) return
    const update = () => {
      setStore("header", el.getBoundingClientRect().height)
    }
    update()
    createResizeObserver(el, update)
  })

  createEffect(() => {
    const el = contentRef
    if (!el) return
    const update = () => {
      setStore("height", el.getBoundingClientRect().height)
    }
    update()
    createResizeObserver(el, update)
  })

  return (
    <DockTray
      data-component="session-followup-dock"
      attach="top"
      style={{
        "overflow-x": "visible",
        "overflow-y": "hidden",
        "max-height": `${Math.max(min(), full() - value() * (full() - min()))}px`,
      }}
    >
      <div ref={contentRef}>
        <div
          ref={headerRef}
          data-action="session-followup-toggle"
          class="pl-3 pr-2 py-1.5 flex items-center gap-2 overflow-visible border-t border-border-weak-base"
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            toggle()
          }}
        >
          <span
            class="text-12-regular text-text-strong cursor-default inline-flex items-baseline shrink-0 overflow-visible"
            aria-label={label()}
            style={{
              "--tool-motion-odometer-ms": "600ms",
              "--tool-motion-mask": "18%",
              "--tool-motion-mask-height": "0px",
              "--tool-motion-spring-ms": "560ms",
              "white-space": "pre",
            }}
          >
            <Index each={progress()}>
              {(item) =>
                item() === queuedToken ? (
                  <AnimatedNumber value={queued()} />
                ) : item() === totalToken ? (
                  <AnimatedNumber value={total()} />
                ) : (
                  <span>{item()}</span>
                )
              }
            </Index>
          </span>
          <div
            data-slot="session-followup-preview"
            class="ml-1 min-w-0 overflow-hidden"
            style={{
              flex: "1 1 auto",
              "max-width": "100%",
            }}
          >
            <TextReveal
              class="text-12-regular text-text-base cursor-default"
              text={store.collapsed ? preview() : undefined}
              duration={600}
              travel={25}
              edge={17}
              spring="cubic-bezier(0.34, 1, 0.64, 1)"
              springSoft="cubic-bezier(0.34, 1, 0.64, 1)"
              growOnly
              truncate
            />
          </div>
          <div class="ml-auto">
            <IconButton
              data-action="session-followup-toggle-button"
              data-collapsed={store.collapsed ? "true" : "false"}
              icon="chevron-down"
              size="small"
              variant="ghost"
              style={{ transform: `rotate(${turn() * 180}deg)` }}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.stopPropagation()
                toggle()
              }}
              aria-label={
                store.collapsed ? language.t("session.followupDock.expand") : language.t("session.followupDock.collapse")
              }
            />
          </div>
        </div>

        <div
          data-slot="session-followup-list"
          aria-hidden={store.collapsed}
          classList={{
            "pointer-events-none": value() > 0.1,
          }}
          style={{
            visibility: store.collapsed ? "hidden" : "visible",
            opacity: `${Math.max(0, Math.min(1, 1 - value()))}`,
            height: value() > 0.99 ? "0px" : "auto",
            overflow: "hidden",
          }}
        >
          <SessionFollowupList
            items={props.items}
            sending={props.sending}
            onSend={props.onSend}
            onEdit={props.onEdit}
          />
        </div>
      </div>
    </DockTray>
  )
}

export function SessionFollowupList(props: {
  items: { id: string; text: string }[]
  sending?: string
  onSend: (id: string) => void
  onEdit: (id: string) => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({
    stuck: false,
  })

  return (
    <div class="relative">
      <div
        class="px-3 pb-7 flex flex-col gap-1.5 max-h-42 overflow-y-auto no-scrollbar"
        style={{ "overflow-anchor": "none" }}
        onScroll={(e) => {
          setStore("stuck", e.currentTarget.scrollTop > 0)
        }}
      >
        <Index each={props.items}>
          {(item) => {
            const sending = () => props.sending === item().id
            const disabled = () => !!props.sending

            return (
              <div class="flex items-start gap-2 min-w-0 py-0.5 group">
                <div class="min-w-0 flex-1">
                  <Checkbox
                    readOnly
                    checked={false}
                    indeterminate={sending()}
                    data-in-progress={sending() ? "" : undefined}
                    data-state={sending() ? "in_progress" : "pending"}
                    style={{
                      "--checkbox-align": "flex-start",
                      "--checkbox-offset": "1px",
                      transition: "opacity 220ms var(--tool-motion-ease, cubic-bezier(0.22, 1, 0.36, 1))",
                      opacity: sending() ? "1" : "0.94",
                    }}
                  >
                    <span
                      class="text-12-regular min-w-0 break-words"
                      style={{
                        "line-height": "var(--line-height-normal)",
                        color: "var(--text-strong)",
                        opacity: sending() ? "1" : "0.92",
                      }}
                    >
                      {item().text}
                    </span>
                  </Checkbox>
                </div>
                <div class="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150">
                  <IconButton
                    icon="arrow-up"
                    size="small"
                    variant="ghost"
                    disabled={disabled()}
                    aria-label={language.t("session.followupDock.sendNow")}
                    onClick={() => props.onSend(item().id)}
                  />
                  <IconButton
                    icon="edit"
                    size="small"
                    variant="ghost"
                    disabled={disabled()}
                    aria-label={language.t("session.followupDock.edit")}
                    onClick={() => props.onEdit(item().id)}
                  />
                </div>
              </div>
            )
          }}
        </Index>
      </div>
      <div
        class="pointer-events-none absolute top-0 left-0 right-0 h-4 transition-opacity duration-150"
        style={{
          background: "linear-gradient(to bottom, var(--background-base), transparent)",
          opacity: store.stuck ? 1 : 0,
        }}
      />
    </div>
  )
}
