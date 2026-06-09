import { Avatar } from "@opencode-ai/ui/avatar"
import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { createMemo, For, type JSX, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useCloud } from "@/context/cloud"
import type { CloudMember } from "@/utils/edge-api-types"
import { showToast } from "@/utils/toast"

// Status options with the dot colors used across the cloud task views (see cloud.tsx STATUS_COLORS).
const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog", color: "#6b7280" },
  { value: "todo", label: "Todo", color: "#9ca3af" },
  { value: "in_progress", label: "In progress", color: "#f97316" },
  { value: "blocked", label: "Blocked", color: "#ef4444" },
  { value: "done", label: "Done", color: "#22c55e" },
] as const

// Canonical numeric priority (orgn task-constants): 0 = none … 4 = urgent. Colors mirror cloud.tsx.
const PRIORITY_OPTIONS = [
  { value: 0, label: "No priority", color: "#6b7280" },
  { value: 1, label: "Low", color: "#9ca3af" },
  { value: 2, label: "Medium", color: "#9ca3af" },
  { value: 3, label: "High", color: "#f59e0b" },
  { value: 4, label: "Urgent", color: "#dc2626" },
] as const

const memberId = (m: CloudMember) => m.user?.id ?? m.userId ?? ""
const memberLabel = (m: CloudMember) => m.user?.name || m.user?.email || memberId(m) || "Unknown"

// Show the platform-appropriate submit shortcut on the primary action.
const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent || "")
const SUBMIT_HINT = isMac ? "⌘↵" : "Ctrl ↵"

const Dot = (props: { color: string }) => (
  <span class="size-2 shrink-0 rounded-full" style={{ "background-color": props.color }} />
)

/**
 * Create a cloud task in the given project, with metadata (status, priority, assignee).
 *
 * UX: a prominent title, an auto-growing description, and a compact row of metadata "chips"
 * (status / priority / assignee) that open dropdowns with color dots + avatars — mirroring the
 * task-detail metadata pills. ⌘/Ctrl+Enter submits; "Create more" keeps the dialog open and
 * preserves the chosen metadata for rapid entry. On success, `onCreated` refetches the list.
 */
export function DialogCreateTask(props: { projectId: string; onCreated?: () => void }) {
  const dialog = useDialog()
  const cloud = useCloud()
  const members = useQuery(() => cloud.membersQuery())
  const memberOptions = createMemo<CloudMember[]>(() => members.data ?? [])

  let titleRef: HTMLInputElement | undefined
  let descRef: HTMLTextAreaElement | undefined

  const [store, setStore] = createStore({
    title: "",
    description: "",
    status: "todo" as string,
    priority: 0,
    assignedToId: undefined as string | undefined,
    createMore: false,
  })

  const currentStatus = createMemo(() => STATUS_OPTIONS.find((o) => o.value === store.status) ?? STATUS_OPTIONS[1])
  const currentPriority = createMemo(() => PRIORITY_OPTIONS.find((o) => o.value === store.priority) ?? PRIORITY_OPTIONS[0])
  const currentAssignee = createMemo(() => memberOptions().find((m) => memberId(m) === store.assignedToId))

  const growDescription = () => {
    if (!descRef) return
    descRef.style.height = "auto"
    descRef.style.height = `${Math.min(descRef.scrollHeight, 168)}px`
  }

  const resetForNext = () => {
    setStore({ title: "", description: "" })
    if (descRef) descRef.style.height = "auto"
    titleRef?.focus()
  }

  const createMut = useMutation(() => ({
    mutationFn: async () => {
      const title = store.title.trim()
      if (!title) return
      await cloud.createTask({
        projectId: props.projectId,
        title,
        description: store.description.trim() || undefined,
        status: store.status,
        priority: store.priority,
        assignedToId: store.assignedToId,
      })
    },
    onSuccess: () => {
      props.onCreated?.()
      if (store.createMore) {
        showToast({ variant: "success", title: "Task created" })
        resetForNext()
        return
      }
      dialog.close()
    },
    onError: (e) => {
      showToast({
        variant: "error",
        title: "Failed to create task",
        description: e instanceof Error ? e.message : String(e),
      })
    },
  }))

  const canSubmit = () => !createMut.isPending && !!store.title.trim()
  const doSubmit = () => {
    if (!canSubmit()) return
    createMut.mutate()
  }

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    doSubmit()
  }

  const onFormKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      doSubmit()
    }
  }

  return (
    <Dialog title="New task" fit class="w-full max-w-[540px] mx-auto">
      <form onSubmit={onSubmit} onKeyDown={onFormKeyDown} class="flex w-full flex-col">
        <div class="flex flex-col gap-1 px-5 pb-3">
          <input
            ref={titleRef}
            autofocus
            type="text"
            aria-label="Task title"
            placeholder="Task title"
            maxLength={140}
            value={store.title}
            onInput={(e) => setStore("title", e.currentTarget.value)}
            class="w-full bg-transparent text-16-medium text-text-strong placeholder:text-text-weak focus-visible:outline-none"
          />
          <textarea
            ref={descRef}
            aria-label="Task description"
            placeholder="Add a description…"
            rows={2}
            value={store.description}
            onInput={(e) => {
              setStore("description", e.currentTarget.value)
              growDescription()
            }}
            class="max-h-44 w-full resize-none overflow-y-auto bg-transparent text-14-regular text-text-base placeholder:text-text-weak focus-visible:outline-none"
          />
        </div>

        {/* Metadata chips — status / priority / assignee, mirroring the task-detail pills. */}
        <div class="flex flex-wrap items-center gap-1.5 px-5 pb-4">
          <MetaChip ariaLabel="Set status" active leading={<Dot color={currentStatus().color} />} label={currentStatus().label}>
            <For each={STATUS_OPTIONS}>
              {(o) => (
                <DropdownMenu.Item class="flex items-center gap-2.5" onSelect={() => setStore("status", o.value)}>
                  <Dot color={o.color} />
                  <DropdownMenu.ItemLabel class="min-w-0 flex-1 truncate">{o.label}</DropdownMenu.ItemLabel>
                  <Show when={store.status === o.value}>
                    <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
                  </Show>
                </DropdownMenu.Item>
              )}
            </For>
          </MetaChip>

          <MetaChip
            ariaLabel="Set priority"
            active={store.priority !== 0}
            leading={<Dot color={currentPriority().color} />}
            label={currentPriority().label}
          >
            <For each={PRIORITY_OPTIONS}>
              {(o) => (
                <DropdownMenu.Item class="flex items-center gap-2.5" onSelect={() => setStore("priority", o.value)}>
                  <Dot color={o.color} />
                  <DropdownMenu.ItemLabel class="min-w-0 flex-1 truncate">{o.label}</DropdownMenu.ItemLabel>
                  <Show when={store.priority === o.value}>
                    <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
                  </Show>
                </DropdownMenu.Item>
              )}
            </For>
          </MetaChip>

          <MetaChip
            ariaLabel="Set assignee"
            active={!!store.assignedToId}
            leading={
              <Show
                when={currentAssignee()}
                fallback={<span class="size-4 shrink-0 rounded-full border border-dashed border-border-strong-base" />}
              >
                {(m) => (
                  <Avatar
                    fallback={memberLabel(m())}
                    src={m().user?.image ?? undefined}
                    class="size-4 shrink-0 rounded-full"
                    size="small"
                  />
                )}
              </Show>
            }
            label={currentAssignee() ? memberLabel(currentAssignee()!) : "Assignee"}
          >
            <DropdownMenu.Item class="flex items-center gap-2.5" onSelect={() => setStore("assignedToId", undefined)}>
              <span class="size-4 shrink-0 rounded-full border border-dashed border-border-strong-base" />
              <DropdownMenu.ItemLabel class="min-w-0 flex-1 truncate">Unassigned</DropdownMenu.ItemLabel>
              <Show when={!store.assignedToId}>
                <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
              </Show>
            </DropdownMenu.Item>
            <Show when={members.isLoading}>
              <div class="px-2 py-1.5 text-12-regular text-text-weak">Loading members…</div>
            </Show>
            <For each={memberOptions()}>
              {(m) => (
                <DropdownMenu.Item
                  class="flex items-center gap-2.5"
                  onSelect={() => setStore("assignedToId", memberId(m))}
                >
                  <Avatar
                    fallback={memberLabel(m)}
                    src={m.user?.image ?? undefined}
                    class="size-4 shrink-0 rounded-full"
                    size="small"
                  />
                  <DropdownMenu.ItemLabel class="min-w-0 flex-1 truncate">{memberLabel(m)}</DropdownMenu.ItemLabel>
                  <Show when={store.assignedToId === memberId(m)}>
                    <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
                  </Show>
                </DropdownMenu.Item>
              )}
            </For>
          </MetaChip>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-border-weak-base px-5 py-3">
          <Switch
            checked={store.createMore}
            onChange={(v) => setStore("createMore", v)}
            class="select-none"
          >
            Create more
          </Switch>
          <div class="flex items-center gap-2">
            <Button type="button" variant="ghost" size="large" onClick={() => dialog.close()}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="large" disabled={!canSubmit()}>
              <span>{createMut.isPending ? "Creating…" : "Create task"}</span>
              <Show when={!createMut.isPending}>
                <span class="text-12-mono opacity-60" aria-hidden="true">
                  {SUBMIT_HINT}
                </span>
              </Show>
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

/** A compact, bordered metadata picker. Solid border when a value is set, dashed when empty. */
function MetaChip(props: {
  ariaLabel: string
  active: boolean
  leading: JSX.Element
  label: string
  children: JSX.Element
}) {
  return (
    <DropdownMenu placement="bottom-start" gutter={4}>
      <DropdownMenu.Trigger
        aria-label={props.ariaLabel}
        classList={{
          "flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-12-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5] data-[expanded]:bg-surface-base-active":
            true,
          "border-border-weak-base bg-surface-base text-text-strong hover:bg-surface-raised-base-hover": props.active,
          "border-dashed border-border-base text-text-weak hover:border-border-strong-base hover:text-text-strong":
            !props.active,
        }}
      >
        {props.leading}
        <span class="max-w-[160px] truncate">{props.label}</span>
        <Icon name="chevron-down" class="-mr-0.5 size-3.5 shrink-0 text-icon-weak-base" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="max-h-[320px] min-w-[208px] overflow-y-auto">{props.children}</DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}
