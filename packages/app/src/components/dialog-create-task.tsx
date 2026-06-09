import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Select } from "@opencode-ai/ui/select"
import { TextField } from "@opencode-ai/ui/text-field"
import { useMutation, useQuery } from "@tanstack/solid-query"
import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useCloud } from "@/context/cloud"
import type { CloudMember } from "@/utils/edge-api-types"
import { showToast } from "@/utils/toast"

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
] as const
type StatusOption = (typeof STATUS_OPTIONS)[number]

// Canonical numeric priority (orgn task-constants): 0 = none … 4 = urgent.
const PRIORITY_OPTIONS = [
  { value: 0, label: "No priority" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
  { value: 4, label: "Urgent" },
] as const
type PriorityOption = (typeof PRIORITY_OPTIONS)[number]

const memberId = (m: CloudMember) => m.user?.id ?? m.userId ?? ""
const memberLabel = (m: CloudMember) => m.user?.name || m.user?.email || memberId(m) || "Unknown"

/**
 * Create a cloud task in the given project, with metadata (status, priority, assignee).
 * On success, calls `onCreated` (e.g. to refetch the task list) and closes the dialog.
 */
export function DialogCreateTask(props: { projectId: string; onCreated?: () => void }) {
  const dialog = useDialog()
  const cloud = useCloud()
  const members = useQuery(() => cloud.membersQuery())
  const memberOptions = createMemo<CloudMember[]>(() => members.data ?? [])

  const [store, setStore] = createStore({
    title: "",
    description: "",
    status: "todo" as string,
    priority: 0,
    assignedToId: undefined as string | undefined,
  })

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
      props.onCreated?.()
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

  const submit = (e: SubmitEvent) => {
    e.preventDefault()
    if (createMut.isPending || !store.title.trim()) return
    createMut.mutate()
  }

  return (
    <Dialog title="New task" class="w-full max-w-[480px] mx-auto">
      <form onSubmit={submit} class="flex flex-col gap-6 p-6 pt-0">
        <div class="flex flex-col gap-4">
          <TextField
            autofocus
            type="text"
            label="Title"
            placeholder="Task title"
            value={store.title}
            onChange={(v) => setStore("title", v)}
          />
          <TextField
            multiline
            label="Description"
            placeholder="Describe the task…"
            value={store.description}
            onChange={(v) => setStore("description", v)}
            class="max-h-28 w-full overflow-y-auto"
          />

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-12-medium text-text-weak">Status</label>
              <Select<StatusOption>
                options={[...STATUS_OPTIONS]}
                current={STATUS_OPTIONS.find((o) => o.value === store.status)}
                value={(o) => o.value}
                label={(o) => o.label}
                onSelect={(o) => o && setStore("status", o.value)}
                variant="secondary"
                size="small"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-12-medium text-text-weak">Priority</label>
              <Select<PriorityOption>
                options={[...PRIORITY_OPTIONS]}
                current={PRIORITY_OPTIONS.find((o) => o.value === store.priority)}
                value={(o) => String(o.value)}
                label={(o) => o.label}
                onSelect={(o) => o && setStore("priority", o.value)}
                variant="secondary"
                size="small"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-12-medium text-text-weak">Assignee</label>
            <Select<CloudMember>
              options={memberOptions()}
              current={memberOptions().find((m) => memberId(m) === store.assignedToId)}
              value={memberId}
              label={memberLabel}
              placeholder={members.isLoading ? "Loading…" : "Unassigned"}
              onSelect={(m) => setStore("assignedToId", m ? memberId(m) : undefined)}
              variant="secondary"
              size="small"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="large" onClick={() => dialog.close()}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="large" disabled={createMut.isPending || !store.title.trim()}>
            {createMut.isPending ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
