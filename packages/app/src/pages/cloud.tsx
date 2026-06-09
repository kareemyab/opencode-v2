import { base64Encode } from "@opencode-ai/core/util/encode"
import { Avatar } from "@opencode-ai/ui/avatar"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Keybind } from "@opencode-ai/ui/keybind"
import { List } from "@opencode-ai/ui/list"
import { Isotype } from "@opencode-ai/ui/logo"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useNavigate } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { createEffect, createMemo, createSignal, For, type JSX, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { useCloud } from "@/context/cloud"
import { formatKeybind, useCommand, type CommandOption } from "@/context/command"
import { useGlobal } from "@/context/global"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useSettings } from "@/context/settings"
import { useTeam } from "@/context/team"
import { homeProjectDirectories } from "@/pages/layout/helpers"
import { TaskFilterMenu, type FilterSection } from "@/components/task-filter-menu"
import { SidebarChromeHeader } from "@/pages/layout/sidebar-chrome"
import { SidebarProfileFooter } from "@/pages/layout/sidebar-profile"
import type {
  CloudActivity,
  CloudComment,
  CloudMember,
  CloudProject,
  CloudTask,
  CloudTaskDetail,
  CloudTrial,
  Team,
} from "@/utils/edge-api-types"
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
  const command = useCommand()
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
      color: statusColor(s),
    }))
    const prioOpts = [...new Set(all.map((t) => t.priority).filter((p): p is number => typeof p === "number"))]
      .sort((a, b) => b - a)
      .map((p) => ({ value: String(p), label: PRIORITY_LABELS[p] ?? `P${p}`, color: PRIORITY_COLORS[p] ?? "#9ca3af" }))
    const findMember = (id: string) => (members.data ?? []).find((x) => (x.user?.id ?? x.userId) === id)
    const assigneeOpts = [...new Set(all.map((t) => t.assignedToId ?? "unassigned"))].map((id) => {
      if (id === "unassigned") return { value: id, label: "Unassigned", avatar: "" }
      const m = findMember(id)
      return { value: id, label: m?.user?.name || m?.user?.email || id, avatar: m?.user?.image ?? "" }
    })
    const labelOpts = (labels.data ?? []).map((l) => ({ value: l.id, label: l.name, color: l.color }))
    return [
      {
        label: "STATUS",
        key: "status",
        variant: "chips",
        options: statusOpts,
        selectedCount: () => filters.statuses.length,
        isSelected: (v) => filters.statuses.includes(v),
        toggle: (v) => toggleArr("statuses", v),
      },
      {
        label: "PRIORITY",
        key: "priority",
        variant: "chips",
        options: prioOpts,
        selectedCount: () => filters.priorities.length,
        isSelected: (v) => filters.priorities.includes(Number(v)),
        toggle: (v) => togglePriority(Number(v)),
      },
      {
        label: "ASSIGNEE",
        key: "assignee",
        variant: "list",
        options: assigneeOpts,
        selectedCount: () => filters.assignees.length,
        isSelected: (v) => filters.assignees.includes(v),
        toggle: (v) => toggleArr("assignees", v),
      },
      {
        label: "LABEL",
        key: "label",
        variant: "list",
        options: labelOpts,
        selectedCount: () => filters.labelIds.length,
        isSelected: (v) => filters.labelIds.includes(v),
        toggle: (v) => toggleArr("labelIds", v),
      },
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
  // `initialPrompt` (set only when freshly creating a worktree) seeds the new session's input.
  const runOpen = async (
    trial: CloudTrial,
    project: CloudProject,
    task: CloudTask | undefined,
    skipProvision: boolean,
    initialPrompt?: string,
  ) => {
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
        initialPrompt,
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
      // Seed the new session's input with the task's title + description.
      const description = task.description?.trim()
      const initialPrompt = [task.title?.trim(), description].filter(Boolean).join("\n\n") || undefined
      await runOpen(trial, project, task, false, initialPrompt)
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
  const openSettings = (tab?: string) => {
    const module = settings.general.newLayoutDesigns()
      ? import("@/components/settings-v2")
      : import("@/components/dialog-settings")
    void module.then((x) => dialog.show(() => <x.DialogSettings tab={tab} />))
  }
  const connectProvider = () => {
    void import("@/components/dialog-select-provider").then((x) => dialog.show(() => <x.DialogSelectProvider />))
  }
  const openServer = () => {
    void import("@/components/dialog-select-server").then((x) => dialog.show(() => <x.DialogSelectServer />))
  }
  // Model list/visibility manager. Cloud-safe: DialogManageModels reads the global ModelsProvider
  // (not the local-project context), so it works here without a mounted project.
  const openModels = () => {
    void import("@/components/dialog-manage-models").then((x) => dialog.show(() => <x.DialogManageModels />))
  }
  // Command palette ("Show All Commands"): lists every command registered for the cloud shell.
  const openCommandPalette = () => {
    dialog.show(() => <CloudCommandPalette />)
  }

  // Quick actions registered as real commands so their keybinds fire globally (via the command
  // context's keydown handler) and they appear in the palette. `file.open` is the id `showPalette`
  // invokes, so the built-in palette keybind (mod+shift+p) opens our palette too.
  const quickActionHandlers: Record<string, () => void> = {
    "project.open": () => void openLocalProject(),
    "server.switch": () => openServer(),
    "settings.open": () => openSettings(),
    "models.manage": () => openModels(),
    "file.open": () => openCommandPalette(),
  }
  command.register("cloud", () =>
    QUICK_ACTIONS.map(
      (action): CommandOption => ({
        id: action.id,
        title: action.label,
        category: "Cloud",
        // The palette keybind is handled by the command context itself; don't double-bind it.
        keybind: action.id === "file.open" ? undefined : action.keybind,
        hidden: action.id === "file.open",
        onSelect: quickActionHandlers[action.id],
      }),
    ),
  )

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
            onSettings={() => openSettings()}
            onUsage={() => openSettings("usage")}
            onConnectProvider={connectProvider}
            onSwitchServer={openServer}
            onHelp={() => platform.openLink("https://orgn.com/support")}
          />
        </aside>
        </Show>

        {/* Middle pane */}
        <main class="min-w-0 flex-1 overflow-y-auto">
          <Switch fallback={<MiddleWelcome />}>
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

/** Per-team credit balance (id-orgn ledger). Lazily fetched + cached; `compact` drops the unit for the trigger. */
function TeamBalance(props: { teamId: string; compact?: boolean }) {
  const cloud = useCloud()
  const credits = useQuery(() => cloud.teamCreditsQuery(props.teamId))

  return (
    <Switch>
      <Match when={credits.isLoading}>
        <span
          aria-hidden="true"
          classList={{
            "h-3 animate-pulse rounded bg-surface-raised-base": true,
            "w-9": props.compact,
            "w-16": !props.compact,
          }}
        />
      </Match>
      <Match when={credits.data}>
        {(c) => (
          <span
            classList={{
              "shrink-0 text-12-mono tabular-nums": true,
              "text-icon-critical-base": c().balance <= 0,
              "text-text-weak": c().balance > 0,
            }}
          >
            {c().balance.toLocaleString()}
            {props.compact ? "" : " credits"}
          </span>
        )}
      </Match>
    </Switch>
  )
}

function TeamSwitcher() {
  const team = useTeam()
  const active = createMemo(() => team.activeTeam())

  return (
    <DropdownMenu placement="bottom-start" gutter={6}>
      <DropdownMenu.Trigger class="group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none data-[expanded]:bg-surface-base-active">
        <Avatar fallback={teamLabel(active())} src={active()?.logo ?? undefined} class="size-6 shrink-0 rounded" size="small" />
        <span class="min-w-0 flex-1 truncate text-14-medium text-text-strong">{teamLabel(active())}</span>
        <Show when={active()}>{(t) => <TeamBalance teamId={t().id} compact />}</Show>
        <Icon name="selector" class="size-4 shrink-0 text-icon-weak-base transition-colors group-hover:text-icon-base" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="z-50 min-w-[260px]">
          <For each={team.teams()}>
            {(t) => (
              <DropdownMenu.Item class="flex items-center gap-2.5" onSelect={() => team.setActiveTeam(t.id)}>
                <Avatar fallback={teamLabel(t)} src={t.logo ?? undefined} class="size-6 shrink-0 rounded" size="small" />
                <div class="flex min-w-0 flex-1 flex-col">
                  <DropdownMenu.ItemLabel class="truncate text-14-regular text-text-strong">
                    {teamLabel(t)}
                  </DropdownMenu.ItemLabel>
                  <TeamBalance teamId={t.id} />
                </div>
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
  const members = useQuery(() => cloud.membersQuery())
  // Fall back to the list row while the full detail loads.
  const meta = createMemo<CloudTaskDetail>(() => detail.data ?? (props.task as CloudTaskDetail))

  const [enhancing, setEnhancing] = createSignal(false)
  // AI-rewrite the description via the team's OLLM key (persisted server-side), then refetch
  // so the new description and the resulting activity entry show up.
  const enhance = async () => {
    if (enhancing()) return
    setEnhancing(true)
    try {
      await cloud.enhanceTask(props.task.id, meta().description ?? undefined)
      await Promise.all([detail.refetch(), activity.refetch()])
    } catch (e) {
      showToast({
        variant: "error",
        title: "Failed to enhance task",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setEnhancing(false)
    }
  }

  return (
    <div class="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-8 py-6">
      {/* Header — title + primary CTA, with the metadata pill row beneath (orgn task layout). */}
      <div class="flex flex-col gap-4 border-b border-border-weak-base pb-5">
        <div class="flex items-start justify-between gap-4">
          <h1
            class="min-w-0 flex-1 text-18-medium text-text-strong"
            style={{ "line-height": "var(--line-height-tight)" }}
          >
            {meta().title}
          </h1>
          <button
            type="button"
            disabled={props.opening}
            onClick={props.onCreate}
            class="flex shrink-0 items-center gap-1.5 border border-border-weak-base bg-surface-base px-2.5 py-1.5 text-13-medium text-text-strong transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5] disabled:opacity-50"
          >
            <Icon name="plus-small" class="size-4" />
            New worktree
          </button>
        </div>
        <MetadataPills meta={meta()} members={members.data ?? []} />
      </div>

      {/* Description */}
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <div class="text-12-mono tracking-[0.12em] text-text-weak">DESCRIPTION</div>
          <button
            type="button"
            disabled={enhancing()}
            onClick={enhance}
            aria-label="Enhance task description with AI"
            title="Rewrite the description to be clearer and more actionable with AI"
            class="flex h-7 shrink-0 items-center gap-1.5 border border-border-weak-base bg-surface-base px-2.5 text-12-mono uppercase tracking-[0.08em] text-text-strong transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3578f5] disabled:opacity-60"
          >
            <Show when={enhancing()} fallback={<Icon name="sparkles" class="size-3.5" />}>
              <Spinner class="size-3.5" />
            </Show>
            {enhancing() ? "Enhancing…" : "Enhance"}
          </button>
        </div>
        <Show
          when={meta().description}
          fallback={<p class="text-13-regular text-text-weak">No description yet. Enhance to draft one with AI.</p>}
        >
          <p
            class="whitespace-pre-wrap break-words text-14-regular text-text-base"
            style={{ "line-height": "var(--line-height-normal)" }}
          >
            {meta().description}
          </p>
        </Show>
      </div>

      {/* Worktrees */}
      <div class="flex flex-col gap-3">
        <div class="text-12-mono tracking-[0.12em] text-text-weak">WORKTREES</div>
        <Switch>
          <Match when={props.trials.isLoading}>
            <div class="flex items-center gap-2 border border-border-weak-base px-4 py-5 text-13-regular text-text-weak">
              <Spinner class="size-4" /> Loading worktrees…
            </div>
          </Match>
          <Match when={props.trials.isError}>
            <div class="border border-border-weak-base px-4 py-5 text-13-regular text-text-weak">
              Failed to load worktrees. Check your connection and try again.
            </div>
          </Match>
          <Match when={(props.trials.data?.length ?? 0) === 0}>
            <div class="flex flex-col items-start gap-1 border border-dashed border-border-weak-base px-4 py-6">
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

      {/* Activity */}
      <ActivitySection activity={activity} />

      {/* Comments */}
      <CommentsSection
        taskId={props.task.id}
        comments={comments}
        onChanged={() => {
          void comments.refetch()
          void activity.refetch()
        }}
      />
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

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  triage: "Triage",
  todo: "To Do",
  to_do: "To Do",
  queued: "Queued",
  in_progress: "In Progress",
  "in-progress": "In Progress",
  in_review: "In Review",
  in_human_review: "In Review",
  blocked: "Blocked",
  completed: "Completed",
  done: "Done",
  canceled: "Canceled",
  duplicate: "Duplicate",
}
const STATUS_COLORS: Record<string, string> = {
  backlog: "#6b7280",
  triage: "#a855f7",
  todo: "#9ca3af",
  to_do: "#9ca3af",
  queued: "#a855f7",
  in_progress: "#f97316",
  "in-progress": "#f97316",
  blocked: "#ef4444",
  completed: "#22c55e",
  done: "#22c55e",
  canceled: "#6b7280",
}
// Priority dot colors (orgn priority-icon): urgent=red, high=amber, medium/low=grey.
const PRIORITY_COLORS: Record<number, string> = { 0: "#6b7280", 1: "#9ca3af", 2: "#9ca3af", 3: "#f59e0b", 4: "#dc2626" }
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
const statusColor = (s: string) => STATUS_COLORS[s] ?? "#9ca3af"

function formatRelative(value: string): string {
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return value
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 60) return "just now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

/** Sharp metadata pill (orgn style): bordered, muted, h-7, icon + label. */
function Pill(props: { children: JSX.Element }) {
  return (
    <span class="flex h-7 shrink-0 items-center gap-1.5 border border-border-weak-base bg-surface-base px-2.5 text-12-medium text-text-strong">
      {props.children}
    </span>
  )
}

/** Inline metadata row: status / priority / assignee / estimate / labels / created — orgn task layout. */
function MetadataPills(props: { meta: CloudTaskDetail; members: CloudMember[] }) {
  const m = () => props.meta
  const assignee = createMemo(() => {
    const id = m().assignedToId ?? m().assignee?.id
    if (!id) return null
    const mem = props.members.find((x) => (x.user?.id ?? x.userId) === id)
    return mem?.user?.name || mem?.user?.email || m().assignee?.name || m().assignee?.email || id
  })

  return (
    <div class="flex flex-wrap items-center gap-1.5">
      <Show when={m().status}>
        <Pill>
          <span class="size-2 shrink-0 rounded-full" style={{ "background-color": statusColor(m().status!) }} />
          {statusLabel(m().status!)}
        </Pill>
      </Show>
      <Show when={typeof m().priority === "number"}>
        <Pill>
          <span
            class="size-2 shrink-0 rounded-full"
            style={{ "background-color": PRIORITY_COLORS[m().priority!] ?? "#9ca3af" }}
          />
          {PRIORITY_LABELS[m().priority!] ?? `P${m().priority}`}
        </Pill>
      </Show>
      <Show when={assignee()}>
        <Pill>
          <Avatar fallback={assignee()!} class="size-4 shrink-0 rounded-full" size="small" />
          <span class="max-w-[160px] truncate">{assignee()}</span>
        </Pill>
      </Show>
      <Show when={typeof m().estimate === "number"}>
        <Pill>{m().estimate} pts</Pill>
      </Show>
      <For each={m().labels ?? []}>
        {(l) => (
          <span
            class="flex h-7 shrink-0 items-center gap-1.5 border px-2.5 text-12-medium"
            style={
              l.color
                ? { "background-color": `${l.color}1a`, color: l.color, "border-color": `${l.color}40` }
                : { "border-color": "var(--border-weak-base)" }
            }
          >
            {l.name}
          </span>
        )}
      </For>
      <Show when={m().createdAt}>
        <span class="flex h-7 shrink-0 items-center px-1 text-12-regular text-text-weak">
          Created {formatRelative(m().createdAt!)}
        </span>
      </Show>
    </div>
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

// Quick actions for the cloud welcome screen. Each `id`/`keybind` is registered as a real command
// in CloudPage, so the keybind fires globally (command context's keydown handler) and the action
// shows up in the palette; `keys` is just the visual rendering of `keybind` (keep them in sync).
// `file.open` is the id the command context's `showPalette` runs, so the built-in palette keybind
// (mod+shift+p) opens our palette too.
const QUICK_ACTIONS: ReadonlyArray<{ id: string; label: string; keybind: string; keys: readonly string[] }> = [
  { id: "project.open", label: "Open Local Folder", keybind: "mod+o", keys: ["⌘", "O"] },
  { id: "server.switch", label: "Open Remote Server", keybind: "mod+shift+o", keys: ["⇧", "⌘", "O"] },
  { id: "settings.open", label: "Open Settings", keybind: "mod+comma", keys: ["⌘", ","] },
  { id: "models.manage", label: "Open Model List", keybind: "mod+shift+m", keys: ["⇧", "⌘", "M"] },
  { id: "file.open", label: "Show All Commands", keybind: "mod+shift+p", keys: ["⇧", "⌘", "P"] },
]

const WELCOME_KEYCAP =
  "inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border-weak-base bg-surface-raised-base px-1.5 text-12-mono text-text-weak"

// Welcome/empty state for the middle pane: a faded brand mark over the quick-action shortcuts.
// Clicking a row triggers the same registered command its keybind does.
function MiddleWelcome() {
  const command = useCommand()

  return (
    <div class="flex h-full flex-col items-center justify-center px-6">
      <Isotype class="h-40 w-auto text-text-weak opacity-60" aria-hidden="true" />
      <div class="mt-12 flex w-[260px] flex-col gap-3.5">
        <For each={QUICK_ACTIONS}>
          {(action) => (
            <button
              type="button"
              class="group flex items-center justify-between gap-4 text-left focus-visible:outline-none"
              onClick={() => command.trigger(action.id)}
            >
              <span class="text-14-mono text-text-weak transition-colors group-hover:text-text-strong">
                {action.label}
              </span>
              <span class="flex items-center gap-1">
                <For each={action.keys}>{(key) => <kbd class={WELCOME_KEYCAP}>{key}</kbd>}</For>
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

// Lightweight command palette for the cloud shell. The local palette (DialogSelectFile) depends on
// file/session/layout contexts that don't exist here, so this simply lists the commands registered
// for the cloud shell and runs the selected one. Opened via "Show All Commands" or mod+shift+p.
function CloudCommandPalette() {
  const command = useCommand()
  const language = useLanguage()
  const dialog = useDialog()

  type PaletteEntry = { id: string; title: string; keybind?: string; option: CommandOption }
  const entries = createMemo<PaletteEntry[]>(() =>
    command.options
      .filter((o) => !o.disabled && !o.hidden && !o.id.startsWith("suggested.") && o.id !== "file.open")
      .map((o) => ({ id: o.id, title: o.title, keybind: o.keybind, option: o })),
  )

  return (
    <Dialog class="pt-3 pb-0 !max-h-[480px]" transition>
      <List
        class="px-3"
        search={{ placeholder: "Search commands…", autofocus: true, hideIcon: true }}
        emptyMessage="No matching commands"
        items={() => entries()}
        key={(item) => item.id}
        filterKeys={["title"]}
        onSelect={(item) => {
          if (!item) return
          dialog.close()
          item.option.onSelect?.("palette")
        }}
      >
        {(item) => (
          <div class="flex w-full items-center justify-between gap-4">
            <span class="whitespace-nowrap text-14-regular text-text-strong">{item.title}</span>
            <Show when={item.keybind}>
              <Keybind class="rounded-[4px]">{formatKeybind(item.keybind ?? "", language.t)}</Keybind>
            </Show>
          </div>
        )}
      </List>
    </Dialog>
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
