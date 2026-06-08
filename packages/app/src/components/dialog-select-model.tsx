import { Popover as Kobalte } from "@kobalte/core/popover"
import { Component, ComponentProps, JSX, ValidComponent } from "solid-js"
import { createStore } from "solid-js/store"
import { useLocal } from "@/context/local"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Button } from "@opencode-ai/ui/button"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { ModelPicker } from "./model-picker"
import { useLanguage } from "@/context/language"

type ModelState = ReturnType<typeof useLocal>["model"]

type ModelSelectorTriggerProps = Omit<ComponentProps<typeof Kobalte.Trigger>, "as" | "ref">
type Dismiss = "escape" | "outside" | "select" | "manage"

export function ModelSelectorPopover(props: {
  provider?: string
  model?: ModelState
  children?: JSX.Element
  triggerAs?: ValidComponent
  triggerProps?: ModelSelectorTriggerProps
  onClose?: (cause: "escape" | "select") => void
}) {
  const local = useLocal()
  const [store, setStore] = createStore<{
    open: boolean
    dismiss: Dismiss | null
  }>({
    open: false,
    dismiss: null,
  })
  const dialog = useDialog()

  const close = (dismiss: Dismiss) => {
    setStore("dismiss", dismiss)
    setStore("open", false)
  }

  const handleManage = () => {
    close("manage")
    void import("./dialog-manage-models").then((x) => {
      dialog.show(() => <x.DialogManageModels />)
    })
  }

  const language = useLanguage()

  return (
    <Kobalte
      open={store.open}
      onOpenChange={(next) => {
        if (next) setStore("dismiss", null)
        setStore("open", next)
      }}
      modal={false}
      placement="top-start"
      gutter={8}
    >
      <Kobalte.Trigger as={props.triggerAs ?? "div"} {...props.triggerProps}>
        {props.children}
      </Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content
          class="z-50 flex h-[min(32rem,calc(100vh-8rem))] w-[min(28rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-border-base bg-surface-raised-stronger-non-alpha p-3 shadow-md outline-none"
          onEscapeKeyDown={(event) => {
            close("escape")
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerDownOutside={() => close("outside")}
          onFocusOutside={() => close("outside")}
          onCloseAutoFocus={(event) => {
            const dismiss = store.dismiss
            if (dismiss === "outside") event.preventDefault()
            if (dismiss === "escape" || dismiss === "select") {
              event.preventDefault()
              props.onClose?.(dismiss)
            }
            setStore("dismiss", null)
          }}
        >
          <Kobalte.Title class="sr-only">{language.t("dialog.model.select.title")}</Kobalte.Title>
          <ModelPicker
            provider={props.provider}
            model={props.model ?? local.model}
            onSelect={() => close("select")}
            action={
              <Tooltip placement="top" value={language.t("dialog.model.manage")}>
                <IconButton
                  icon="sliders"
                  variant="ghost"
                  iconSize="normal"
                  class="size-6"
                  aria-label={language.t("dialog.model.manage")}
                  onClick={handleManage}
                />
              </Tooltip>
            }
          />
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}

export const DialogSelectModel: Component<{ provider?: string; model?: ModelState }> = (props) => {
  const local = useLocal()
  const dialog = useDialog()
  const language = useLanguage()

  const provider = () => {
    void import("./dialog-select-provider").then((x) => {
      dialog.show(() => <x.DialogSelectProvider />)
    })
  }

  const manage = () => {
    void import("./dialog-manage-models").then((x) => {
      dialog.show(() => <x.DialogManageModels />)
    })
  }

  return (
    <Dialog
      size="large"
      title={language.t("dialog.model.select.title")}
      action={
        <Button class="h-7 -my-1 text-14-medium" icon="plus-small" tabIndex={-1} onClick={provider}>
          {language.t("command.provider.connect")}
        </Button>
      }
    >
      <div class="flex min-h-[min(28rem,calc(100vh-12rem))] flex-1 flex-col gap-3 px-3 pb-4">
        <ModelPicker
          class="flex-1"
          provider={props.provider}
          model={props.model ?? local.model}
          onSelect={() => dialog.close()}
        />
        <Button variant="ghost" class="self-start text-text-base" onClick={manage}>
          {language.t("dialog.model.manage")}
        </Button>
      </div>
    </Dialog>
  )
}
