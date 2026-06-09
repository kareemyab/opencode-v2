import { base64Encode } from "@opencode-ai/core/util/encode"
import { Avatar } from "@opencode-ai/ui/avatar"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useNavigate } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { createEffect, createMemo, createSignal, For, type JSX, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { useCloud } from "@/context/cloud"
import { useGlobal } from "@/context/global"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useSettings } from "@/context/settings"
import { useTeam } from "@/context/team"
import { homeProjectDirectories } from "@/pages/layout/helpers"
import { TaskFilterMenu, type FilterSection } from "@/components/task-filter-menu"
import { SidebarChromeHeader } from "@/pages/layout/sidebar-chrome"
import { SidebarProfileFooter } from "@/pages/layout/sidebar-profile"
import type { CloudActivity, CloudComment, CloudProject, CloudTask, CloudTaskDetail, CloudTrial, Team } from "@/utils/edge-api-types"
import { openCloudTrial } from "@/utils/open-cloud"
import { showToast } from "@/utils/toast"

const teamLabel = (team: Team | undefined) => team?.name ?? team?.displayName ?? team?.id ?? "Team"
const trialLabel = (trial: CloudTrial) => trial.agentOSBranch || trial.title || trial.id

interface CloudNav {
  projectId?: string
  taskId?: string
  opening: boolean
  progress: string
}

/**
 * Dedicated cloud shell (mounted outside the local-project Layout via app.tsx).
 *
 * Sidebar = team switcher (pinned top) → Projects → (drill in) → Tasks. The middle pane
 * shows the selected task's details + its worktrees (trials); opening one provisions its
 * sandbox and pins a session against it. "New worktree" creates a trial then provisions+opens.
 */
export default function CloudPage() {
  const team = useTeam()
  const cloud = useCloud()
  const server = useServer()
  const platform = usePlatform()
  const global = useGlobal()
  const settings = useSettings()
  const dialog = useDialog()
  const navigate = useNavigate()

  // Unified top-bar chrome (matches the local layout): traffic-light inset + a toggle that
  // collapses the cloud sidebar.
  const trafficLightMac = () => platform.platform === "desktop" && platform.os === "macos"
  const titlebarZoom = () => platform.webviewZoom?.() ?? 1
  const [sidebarShown, setSidebarShown] = createSignal(true)

  const [nav, setNav] = createStore<CloudNav>({ opening: false, progress: "" })

  // Task filters. status/priority/assignee are filtered client-side; labels filter server-side.
  const [filters, setFilters] = createStore({
    statuses: [] as string[],
    priorities: [] as number[],
    assignees: [] as string[],
    labelIds: [] as string[],
  })
  const toggleArr = (key: "statuses" | "assignees" | "labelIds", value: string) => {
    const arr = filters[key]
    setFilters(key, arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value])
  }
  const togglePriority = (value: number) => {
    const arr = filters.priorities
    setFilters("priorities", arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value])
  }
  const clearFilters = () => setFilters({ statuses: [], priorities: [], assignees: [], labelIds: [] })
  const filterCount = createMemo(
    () => filters.statuses.length + filters.priorities.length + filters.assignees.length + filters.labelIds.length,
  )

  const projects = useQuery(() => cloud.projectsQuery())
  const tasks = useQuery(() => cloud.tasksQuery(nav.projectId, { labelIds: filters.labelIds }))
  const trials = useQuery(() => cloud.trialsQuery(nav.taskId))
  const members = useQuery(() => cloud.membersQuery())
  const labels = useQuery(() => cloud.labelsQuery(nav.projectId))

  // Apply status/priority/assignee client-side on top of the (label-filtered) task list.
  const filteredTasks = createMemo<CloudTask[]>(() => {
    const all = tasks.data ?? []
    const { statuses, priorities, assignees } = filters
    if (!statuses.length && !priorities.length && !assignees.length) return all
    return all.filter((t) => {
      if (statuses.length && !statuses.includes(t.status ?? "")) return false
      if (priorities.length && !priorities.includes(t.priority ?? -1)) return false
      if (assignees.length && !assignees.includes(t.assignedToId ?? "unassigned")) return false
      return true
    })
  })

  // Filter options, derived from the loaded tasks (+ members for names, labels for the label list).
  const filterSections = createMemo<FilterSection[]>(() => {
    const all = tasks.data ?? []
    const statusOpts = [...new Set(all.map((t) => t.status).filter((s): s is string => !!s))].map((s) => ({
      value: s,
      label: s.replace(/[-_]/g, " "),
    }))
    const prioOpts = [...new Set(all.map((t) => t.priority).filter((p): p is number => typeof p === "number"))]
      .sort((a, b) => b - a)
      .map((p) => ({ value: String(p), label: PRIORITY_LABELS[p] ?? `P${p}` }))
    const memberName = (id: string) => {
      const m = (members.data ?? []).find((x) => (x.user?.id ?? x.userId) === id)
      return m?.user?.name || m?.user?.email || id
    }
    const assigneeOpts = [...new Set(all.map((t) => t.assignedToId ?? "unassigned"))].map((id) => ({
      value: id,
      label: id === "unassigned" ? "Unassigned" : memberName(id),
    }))
    const labelOpts = (labels.data ?? []).map((l) => ({ value: l.id, label: l.name, color: l.color }))
    return [
      { label: "STATUS", options: statusOpts, isSelected: (v) => filters.statuses.includes(v), toggle: (v) => toggleArr("statuses", v) },
      {
        label: "PRIORITY",
        options: prioOpts,
        isSelected: (v) => filters.priorities.includes(Number(v)),
        toggle: (v) => togglePriority(Number(v)),
      },
      { label: "ASSIGNEE", options: assigneeOpts, isSelected: (v) => filters.assignees.includes(v), toggle: (v) => toggleArr("assignees", v) },
      { label: "LABEL", options: labelOpts, isSelected: (v) => filters.labelIds.includes(v), toggle: (v) => toggleArr("labelIds", v) },
    ]
  })

  const selectedProject = createMemo<CloudProject | undefined>(() =>
    (projects.data ?? []).find((project) => project.id === nav.projectId),
  )
  const selectedTask = createMemo<CloudTask | undefined>(() =>
    (tasks.data ?? []).find((task) => task.id === nav.taskId),
  )

  // Drop project + task selection whenever the active team changes (its data differs).
  createEffect(() => {
    team.activeTeamId()
    setNav({ projectId: undefined, taskId: undefined })
  })

  // Provision (if needed) + pin a session against the trial's sandbox, then navigate into it.
  // On success the route/server mutation unmounts this shell; on failure we surface a toast.
  const runOpen = async (trial: CloudTrial, project: CloudProject, task: CloudTask | undefined, skipProvision: boolean) => {
    await openCloudTrial(
      {
        status: (id) => cloud.sandboxStatus(id),
        provision: (id) => cloud.provisionSandbox(id),
        start: (id) => cloud.startSandbox(id),
        connect: (origin) => server.add({ type: "http", http: { url: origin } }),
        navigate: (path) => navigate(path, { replace: true }),
        setActiveTrial: (d) => team.setActiveTrial(d),
        probe: platform.apiFetch
          ? async (origin) => {
              const res = await platform.apiFetch!({ url: origin, method: "GET" }).catch(() => null)
              return !!res && res.status < 500
            }
          : undefined,
        onProgress: (m) => setNav("progress", m),
      },
      {
        trialId: trial.id,
        skipProvision,
        descriptor: {
          trialId: trial.id,
          trialTitle: trial.title ?? null,
          projectId: project.id,
          projectName: project.name,
          teamId: team.activeTeamId() ?? "",
          taskId: task?.id ?? null,
          taskTitle: task?.title ?? null,
          activatedAt: new Date().toISOString(),
        },
      },
    )
  }

  const openTrial = async (trial: CloudTrial) => {
    const project = selectedProject()
    if (!project || nav.opening) return
    setNav({ opening: true, progress: "Checking sandbox…" })
    try {
      await runOpen(trial, project, selectedTask(), trial.skipClientSandboxProvision ?? false)
    } catch (e) {
      showToast({
        variant: "error",
        title: "Failed to open worktree",
        description: e instanceof Error ? e.message : String(e),
      })
      setNav("opening", false)
    }
  }

  const createWorktree = async () => {
    const project = selectedProject()
    const task = selectedTask()
    if (!project || !task || nav.opening) return
    setNav({ opening: true, progress: "Creating worktree…" })
    try {
      const trial = await cloud.createTrial({
        projectId: project.id,
        taskId: task.id,
        title: task.title ? `${task.title} — worktree` : "New worktree",
        type: "CODE",
        baseBranch: project.defaultBranch ?? undefined,
        repoFullName: project.repoFullName ?? undefined,
        repoUrl: project.repoUrl ?? undefined,
        chatMode: "csbopencode",
        agentId: "csbopencode",
      })
      await runOpen(trial, project, task, false)
    } catch (e) {
      showToast({
        variant: "error",
        title: "Failed to create worktree",
        description: e instanceof Error ? e.message : String(e),
      })
      void trials.refetch()
      setNav("opening", false)
    }
  }

  // Open a local project from the cloud screen: pick a folder (native picker on desktop, else
  // the directory dialog), register it on the active (local) server, and navigate into it —
  // leaving the cloud shell for the local Layout. Mirrors home.tsx's `chooseProject`.
  const openLocalProject = async () => {
    const conn = server.current
    if (!conn) return
    const ctx = global.createServerCtx(conn)
    const resolve = (result: string | string[] | null) => {
      const directories = homeProjectDirectories(result)
      const directory = directories[0]
      if (!directory) return
      directories.forEach(ctx.projects.open)
      ctx.projects.touch(directory)
      navigate(`/${base64Encode(directory)}/session`)
    }
    if (platform.openDirectoryPickerDialog && ctx.isLocal) {
      const result = await platform.openDirectoryPickerDialog({ title: "Open project", multiple: true })
      resolve(result)
      return
    }
    dialog.show(
      () => <DialogSelectDirectory multiple={true} onSelect={resolve} server={conn} />,
      () => resolve(null),
    )
  }

  // Profile-footer actions (mirror the local Layout's sidebar footer).
  const openSettings = () => {
    const module = settings.general.newLayoutDesigns()
      ? import("@/components/settings-v2")
      : import("@/components/dialog-settings")
    void module.then((x) => dialog.show(() => <x.DialogSettings />))
  }
  const connectProvider = () => {
    void import("@/components/dialog-select-provider").then((x) => dialog.show(() => <x.DialogSelectProvider />))
  }
  const openServer = () => {
    void import("@/components/dialog-select-server").then((x) => dialog.show(() => <x.DialogSelectServer />))
  }
  // New-task dialog for the selected project; refetch the task list on success.
  const openCreateTask = () => {
    const projectId = nav.projectId
    if (!projectId) return
    void import("@/components/dialog-create-task").then((x) =>
      dialog.show(() => <x.DialogCreateTask projectId={projectId} onCreated={() => void tasks.refetch()} />),
    )
  }

  return (
    <div class="relative flex h-dvh w-screen flex-col overflow-hidden bg-background-base text-text-base select-none">
      {/* Unified top bar: traffic-light inset + sidebar toggle + continuous border (matches local). */}
      <SidebarChromeHeader
        mac={trafficLightMac()}
        zoom={titlebarZoom()}
        onToggleSidebar={() => setSidebarShown((v) => !v)}
        toggleLabel="Toggle sidebar"
        toggleKeybind=""
      />

      <div class="flex min-h-0 flex-1">
        {/* Sidebar — floating rounded card (matches the local layout sidebar). */}
        <Show when={sidebarShown()}>
        <aside
          class="m-2 flex w-72 shrink-0 flex-col overflow-hidden border border-border-weak-base bg-background-stronger"
          style={{ "border-radius": "14px", "box-shadow": "0 12px 32px -12px rgba(0, 0, 0, 0.7)" }}
        >
          <div class="shrink-0 px-3 pb-3 pt-1">
            <TeamSwitcher />
          </div>

          <Switch>
            {/* Tasks level — a project is selected. */}
            <Match when={selectedProject()} keyed>
              {(project) => (
                <>
                  <button
                    type="button"
                    class="mx-2 mb-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-13-regular text-text-weak transition-colors hover:bg-surface-raised-base-hover hover:text-text-strong focus-visible:outline-none"
                    onClick={() => setNav({ projectId: undefined, taskId: undefined })}
                  >
                    <Icon name="chevron-left" class="size-3.5 shrink-0" />
                    <span class="min-w-0 flex-1 truncate">{project.name}</span>
                  </button>
                  <div class="shrink-0 flex items-center justify-between gap-1 px-4 pb-2 pt-1">
                    <span class="text-12-mono tracking-[0.12em] text-text-weak">TASKS</span>
                    <div class="flex items-center gap-0.5">
                      <TaskFilterMenu count={filterCount()} sections={filterSections()} onClear={clearFilters} />
                      <IconButton
                        icon="plus-small"
                        variant="ghost"
                        size="small"
                        class="shrink-0"
                        onClick={() => openCreateTask()}
                        aria-label="New task"
                      />
                    </div>
                  </div>
                  <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                    <Switch>
                      <Match when={tasks.isLoading}>
                        <SidebarLoading>Loading tasks…</SidebarLoading>
                      </Match>
                      <Match when={tasks.isError}>
                        <SidebarHint>Failed to load tasks. Check your connection and try again.</SidebarHint>
                      </Match>
                      <Match when={filteredTasks().length === 0}>
                        <SidebarHint>
                          {filterCount() > 0 ? "No tasks match the filters." : "No tasks in this project."}
                        </SidebarHint>
                      </Match>
                      <Match when={filteredTasks()}>
                        <ul class="flex flex-col gap-0.5">
                          <For each={filteredTasks()}>
                            {(task) => (
                              <TaskRow
                                task={task}
                                active={task.id === nav.taskId}
                                onSelect={() => setNav("taskId", task.id)}
                              />
                            )}
                          </For>
                        </ul>
                      </Match>
                    </Switch>
                  </div>
                </>
              )}
            </Match>

            {/* Projects level — no project selected. */}
            <Match when={!selectedProject()}>
              <div class="shrink-0 px-4 pb-2 pt-1 text-12-mono tracking-[0.12em] text-text-weak">PROJECTS</div>
              <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                <Switch>
                  <Match when={!team.activeTeamId()}>
                    <SidebarHint>
                      {team.loading() ? "Loading teams…" : "No team available — sign in or check your connection."}
                    </SidebarHint>
                  </Match>
                  <Match when={projects.isLoading}>
                    <SidebarLoading>Loading projects…</SidebarLoading>
                  </Match>
                  <Match when={projects.isError}>
                    <SidebarHint>Failed to load projects. Check your connection and try again.</SidebarHint>
                  </Match>
                  <Match when={(projects.data?.length ?? 0) === 0}>
                    <SidebarHint>No cloud projects in this team.</SidebarHint>
                  </Match>
                  <Match when={projects.data}>
                    <ul class="flex flex-col gap-0.5">
                      <For each={projects.data}>
                        {(project) => (
                          <ProjectRow project={project} onSelect={() => setNav({ projectId: project.id, taskId: undefined })} />
                        )}
                      </For>
                    </ul>
                  </Match>
                </Switch>
              </div>
            </Match>
          </Switch>

          <SidebarProfileFooter
            onSettings={openSettings}
            onConnectProvider={connectProvider}
            onSwitchServer={openServer}
            onHelp={() => platform.openLink("https://orgn.com/support")}
          />
        </aside>
        </Show>

        {/* Middle pane */}
        <main class="min-w-0 flex-1 overflow-y-auto">
          <Switch
            fallback={
              <MiddleEmpty
                icon="folder"
                title="Select a project"
                hint="Pick a project from the sidebar to view its tasks and worktrees."
                onOpenLocal={() => void openLocalProject()}
              />
            }
          >
            <Match when={selectedTask()} keyed>
              {(task) => (
                <TaskDetail
                  task={task}
                  trials={trials}
                  opening={nav.opening}
                  onOpen={(trial) => void openTrial(trial)}
                  onCreate={() => void createWorktree()}
                />
              )}
            </Match>
            <Match when={selectedProject()}>
              <MiddleEmpty icon="task" title="Select a task" hint="Pick a task from the sidebar to view its details and worktrees." />
            </Match>
          </Switch>
        </main>
      </div>

      <Show when={nav.opening}>
        <OpeningOverlay progress={nav.progress} />
      </Show>
    </div>
  )
}

function TeamSwitcher() {
  const team = useTeam()
  const active = createMemo(() => team.activeTeam())

  return (
    <DropdownMenu placement="bottom-start" gutter={6}>
      <DropdownMenu.Trigger class="group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none data-[expanded]:bg-surface-base-active">
        <Avatar fallback={teamLabel(active())} class="size-6 shrink-0 rounded" size="small" />
        <span class="min-w-0 flex-1 truncate text-14-medium text-text-strong">{teamLabel(active())}</span>
        <Icon name="selector" class="size-3.5 shrink-0 text-icon-weak-base" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="z-50 min-w-[248px]">
          <For each={team.teams()}>
            {(t) => (
              <DropdownMenu.Item class="flex items-center gap-2" onSelect={() => team.setActiveTeam(t.id)}>
                <Avatar fallback={teamLabel(t)} class="size-5 shrink-0 rounded" size="small" />
                <DropdownMenu.ItemLabel class="min-w-0 flex-1 truncate">{teamLabel(t)}</DropdownMenu.ItemLabel>
                <Show when={t.id === team.activeTeamId()}>
                  <Icon name="check" class="size-3.5 shrink-0 text-icon-base" />
                </Show>
              </DropdownMenu.Item>
            )}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

function ProjectRow(props: { project: CloudProject; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={props.onSelect}
        class="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none"
      >
        <Avatar fallback={props.project.name || props.project.id} class="size-6 shrink-0 rounded" size="small" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-14-regular text-text-strong">{props.project.name}</div>
          <Show when={props.project.repoFullName}>
            <div class="truncate text-12-mono text-text-weak">{props.project.repoFullName}</div>
          </Show>
        </div>
        <Icon name="chevron-right" class="size-4 shrink-0 text-icon-weak-base" />
      </button>
    </li>
  )
}

function TaskRow(props: { task: CloudTask; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={props.onSelect}
        classList={{
          "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none": true,
          "bg-surface-base-active": props.active,
          "hover:bg-surface-raised-base-hover": !props.active,
        }}
      >
        <Icon name="task" class="size-4 shrink-0 text-icon-weak-base" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-14-regular text-text-strong">{props.task.title}</div>
          <Show when={props.task.status}>
            <div class="truncate text-12-mono text-text-weak">{props.task.status}</div>
          </Show>
        </div>
        <Show when={(props.task.trialCount ?? 0) > 0}>
          <span class="shrink-0 text-12-mono text-text-weak">{props.task.trialCount}</span>
        </Show>
      </button>
    </li>
  )
}

function TaskDetail(props: {
  task: CloudTask
  trials: { data?: CloudTrial[]; isLoading: boolean; isError: boolean }
  opening: boolean
  onOpen: (trial: CloudTrial) => void
  onCreate: () => void
}) {
  const cloud = useCloud()
  // Keyed-remounted per task (see the parent <Match keyed>), so these track the selected task.
  const detail = useQuery(() => cloud.taskQuery(props.task.id))
  const comments = useQuery(() => cloud.commentsQuery(props.task.id))
  const activity = useQuery(() => cloud.activityQuery(props.task.id))
  // Fall back to the list row while the full detail loads.
  const meta = createMemo<CloudTaskDetail>(() => detail.data ?? (props.task as CloudTaskDetail))

  return (
    <div class="mx-auto flex w-full max-w-[760px] flex-col gap-7 px-8 py-10">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2.5">
          <h1 class="min-w-0 text-16-medium text-text-strong">{meta().title}</h1>
          <Show when={meta().status}>
            <StatusBadge status={meta().status!} />
          </Show>
        </div>
        <Show when={meta().description}>
          <p class="text-14-regular text-text-base" style={{ "line-height": "var(--line-height-normal)" }}>
            {meta().description}
          </p>
        </Show>
      </div>

      <MetadataSection meta={meta()} />

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div class="text-12-mono tracking-[0.12em] text-text-weak">WORKTREES</div>
          <button
            type="button"
            disabled={props.opening}
            onClick={props.onCreate}
            class="flex items-center gap-1.5 rounded-md border border-border-weak-base px-2.5 py-1.5 text-13-medium text-text-strong transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5] disabled:opacity-50"
          >
            <Icon name="plus-small" class="size-4" />
            New worktree
          </button>
        </div>

        <Switch>
          <Match when={props.trials.isLoading}>
            <div class="flex items-center gap-2 rounded-lg border border-border-weak-base px-4 py-5 text-13-regular text-text-weak">
              <Spinner class="size-4" /> Loading worktrees…
            </div>
          </Match>
          <Match when={props.trials.isError}>
            <div class="rounded-lg border border-border-weak-base px-4 py-5 text-13-regular text-text-weak">
              Failed to load worktrees. Check your connection and try again.
            </div>
          </Match>
          <Match when={(props.trials.data?.length ?? 0) === 0}>
            <div class="flex flex-col items-start gap-1 rounded-lg border border-dashed border-border-weak-base px-4 py-6">
              <div class="text-13-medium text-text-strong">No worktrees yet</div>
              <div class="text-13-regular text-text-weak">Create a worktree to start a session for this task.</div>
            </div>
          </Match>
          <Match when={props.trials.data}>
            <ul class="flex flex-col gap-2">
              <For each={props.trials.data}>
                {(trial) => <TrialRow trial={trial} disabled={props.opening} onOpen={() => props.onOpen(trial)} />}
              </For>
            </ul>
          </Match>
        </Switch>
      </div>

      <CommentsSection
        taskId={props.task.id}
        comments={comments}
        onChanged={() => {
          void comments.refetch()
          void activity.refetch()
        }}
      />

      <ActivitySection activity={activity} />
    </div>
  )
}

// Canonical numeric priority (orgn task-constants PRIORITY_NUMBER_TO_STRING): 1=low … 4=urgent.
const PRIORITY_LABELS: Record<number, string> = { 0: "No priority", 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" }

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function MetadataSection(props: { meta: CloudTaskDetail }) {
  const rows = createMemo(() => {
    const m = props.meta
    const out: Array<{ label: string; value: string }> = []
    if (m.status) out.push({ label: "Status", value: m.status })
    if (typeof m.priority === "number") out.push({ label: "Priority", value: PRIORITY_LABELS[m.priority] ?? `P${m.priority}` })
    if (typeof m.estimate === "number") out.push({ label: "Estimate", value: String(m.estimate) })
    const assignee = m.assignee?.name || m.assignee?.email || m.assignedToId
    if (assignee) out.push({ label: "Assignee", value: assignee })
    if (m.labels?.length) out.push({ label: "Labels", value: m.labels.map((l) => l.name).join(", ") })
    if (m.createdAt) out.push({ label: "Created", value: formatDate(m.createdAt) })
    if (m.updatedAt) out.push({ label: "Updated", value: formatDate(m.updatedAt) })
    return out
  })

  return (
    <Show when={rows().length}>
      <div class="flex flex-col gap-3">
        <div class="text-12-mono tracking-[0.12em] text-text-weak">DETAILS</div>
        <dl class="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2">
          <For each={rows()}>
            {(row) => (
              <div class="contents">
                <dt class="text-13-regular text-text-weak">{row.label}</dt>
                <dd class="break-words text-13-regular text-text-strong">{row.value}</dd>
              </div>
            )}
          </For>
        </dl>
      </div>
    </Show>
  )
}

function CommentsSection(props: {
  taskId: string
  comments: { data?: CloudComment[]; isLoading: boolean; isError: boolean }
  onChanged: () => void
}) {
  const cloud = useCloud()
  const [draft, setDraft] = createSignal("")
  const [posting, setPosting] = createSignal(false)

  const submit = async () => {
    const body = draft().trim()
    if (!body || posting()) return
    setPosting(true)
    try {
      await cloud.addComment(props.taskId, body)
      setDraft("")
      props.onChanged()
    } catch (e) {
      showToast({
        variant: "error",
        title: "Failed to post comment",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setPosting(false)
    }
  }

  return (
    <div class="flex flex-col gap-3">
      <div class="text-12-mono tracking-[0.12em] text-text-weak">COMMENTS</div>
      <Switch>
        <Match when={props.comments.isLoading}>
          <div class="flex items-center gap-2 text-13-regular text-text-weak">
            <Spinner class="size-4" /> Loading comments…
          </div>
        </Match>
        <Match when={props.comments.isError}>
          <div class="text-13-regular text-text-weak">Failed to load comments.</div>
        </Match>
        <Match when={(props.comments.data?.length ?? 0) === 0}>
          <div class="text-13-regular text-text-weak">No comments yet.</div>
        </Match>
        <Match when={props.comments.data}>
          <ul class="flex flex-col gap-3.5">
            <For each={props.comments.data}>{(c) => <CommentRow comment={c} />}</For>
          </ul>
        </Match>
      </Switch>

      <div class="flex flex-col gap-2 rounded-lg border border-border-weak-base p-2">
        <textarea
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          placeholder="Write a comment…"
          rows={3}
          class="w-full resize-none bg-transparent text-13-regular text-text-strong placeholder:text-text-weak focus-visible:outline-none"
        />
        <div class="flex justify-end">
          <button
            type="button"
            disabled={posting() || !draft().trim()}
            onClick={() => void submit()}
            class="flex items-center gap-1.5 rounded-md border border-border-weak-base px-2.5 py-1.5 text-13-medium text-text-strong transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5] disabled:opacity-50"
          >
            <Show when={posting()}>
              <Spinner class="size-3.5" />
            </Show>
            Comment
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentRow(props: { comment: CloudComment }) {
  const who = createMemo(() => props.comment.authorEmail || props.comment.authorUserId || "Unknown")
  return (
    <li class="flex gap-2.5">
      <Avatar fallback={who()} class="size-7 shrink-0 rounded-full" size="small" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="truncate text-13-medium text-text-strong">{who()}</span>
          <Show when={props.comment.createdAt}>
            <span class="shrink-0 text-12-regular text-text-weak">{formatDate(props.comment.createdAt!)}</span>
          </Show>
        </div>
        <div class="whitespace-pre-wrap break-words text-13-regular text-text-base">{props.comment.body}</div>
      </div>
    </li>
  )
}

function ActivitySection(props: { activity: { data?: CloudActivity[]; isLoading: boolean; isError: boolean } }) {
  return (
    <div class="flex flex-col gap-3">
      <div class="text-12-mono tracking-[0.12em] text-text-weak">ACTIVITY</div>
      <Switch>
        <Match when={props.activity.isLoading}>
          <div class="flex items-center gap-2 text-13-regular text-text-weak">
            <Spinner class="size-4" /> Loading activity…
          </div>
        </Match>
        <Match when={props.activity.isError}>
          <div class="text-13-regular text-text-weak">Failed to load activity.</div>
        </Match>
        <Match when={(props.activity.data?.length ?? 0) === 0}>
          <div class="text-13-regular text-text-weak">No activity yet.</div>
        </Match>
        <Match when={props.activity.data}>
          <ul class="flex flex-col gap-2.5">
            <For each={props.activity.data}>{(a) => <ActivityRow activity={a} />}</For>
          </ul>
        </Match>
      </Switch>
    </div>
  )
}

function ActivityRow(props: { activity: CloudActivity }) {
  const who = createMemo(
    () => props.activity.user?.name || props.activity.user?.email || props.activity.user?.githubUsername || "System",
  )
  const change = createMemo(() => {
    const a = props.activity
    if (a.field && (a.oldValue || a.newValue)) return `${a.field}: ${a.oldValue ?? "—"} → ${a.newValue ?? "—"}`
    return a.field ?? ""
  })
  return (
    <li class="flex items-start gap-2.5">
      <Icon name="status" class="mt-0.5 size-3.5 shrink-0 text-icon-weak-base" />
      <div class="min-w-0 flex-1 text-13-regular text-text-base">
        <span class="text-text-strong">{who()}</span> {props.activity.action.replace(/_/g, " ")}
        <Show when={change()}>
          <span class="text-text-weak"> · {change()}</span>
        </Show>
        <Show when={props.activity.createdAt}>
          <span class="ml-1 text-12-regular text-text-weak">{formatDate(props.activity.createdAt!)}</span>
        </Show>
      </div>
    </li>
  )
}

function TrialRow(props: { trial: CloudTrial; disabled: boolean; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onOpen}
        class="group flex w-full items-center justify-between gap-3 rounded-lg border border-border-weak-base px-4 py-3 text-left transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5] disabled:opacity-50"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <Icon name="branch" class="size-4 shrink-0 text-icon-weak-base" />
          <div class="min-w-0">
            <div class="truncate text-14-regular text-text-strong">{trialLabel(props.trial)}</div>
            <Show when={[props.trial.type, props.trial.status].filter(Boolean).length}>
              <div class="truncate text-12-mono text-text-weak">
                {[props.trial.type, props.trial.status].filter(Boolean).join(" · ")}
              </div>
            </Show>
          </div>
        </div>
        <Icon name="arrow-right" class="size-4 shrink-0 text-icon-weak-base transition-colors group-hover:text-icon-base" />
      </button>
    </li>
  )
}

function StatusBadge(props: { status: string }) {
  return (
    <span class="shrink-0 rounded-full border border-border-weak-base px-2 py-0.5 text-12-mono text-text-weak">
      {props.status}
    </span>
  )
}

function MiddleEmpty(props: { icon: "folder" | "task"; title: string; hint: string; onOpenLocal?: () => void }) {
  return (
    <div class="flex h-full flex-col items-center justify-center px-6 text-center">
      <div class="flex max-w-72 flex-col items-center gap-3">
        <div class="flex size-12 items-center justify-center rounded-full bg-surface-raised-base">
          <Icon name={props.icon} class="size-6 text-icon-weak-base" />
        </div>
        <div class="text-14-medium text-text-strong">{props.title}</div>
        <div class="text-13-regular text-text-weak" style={{ "line-height": "var(--line-height-normal)" }}>
          {props.hint}
        </div>
        <Show when={props.onOpenLocal}>
          <button
            type="button"
            onClick={() => props.onOpenLocal?.()}
            class="mt-1 flex items-center gap-1.5 rounded-md border border-border-weak-base px-3 py-1.5 text-13-medium text-text-strong transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5]"
          >
            <Icon name="folder" class="size-4 text-icon-weak-base" />
            Open a local project
          </button>
        </Show>
      </div>
    </div>
  )
}

function OpeningOverlay(props: { progress: string }) {
  return (
    <div class="absolute inset-0 z-50 flex items-center justify-center bg-background-base/80 backdrop-blur-sm">
      <div class="flex flex-col items-center gap-3">
        <Spinner class="size-6" />
        <div class="text-14-mono text-text-weak">{props.progress || "Opening…"}</div>
      </div>
    </div>
  )
}

function SidebarLoading(props: { children: JSX.Element }) {
  return (
    <div class="flex items-center gap-2 px-2 py-3 text-13-regular text-text-weak">
      <Spinner class="size-4" /> {props.children}
    </div>
  )
}

function SidebarHint(props: { children: JSX.Element }) {
  return <div class="px-2 py-3 text-13-regular text-text-weak">{props.children}</div>
}
