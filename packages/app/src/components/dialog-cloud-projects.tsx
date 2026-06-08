import { Dialog } from "@opencode-ai/ui/dialog"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useQuery } from "@tanstack/solid-query"
import { useNavigate } from "@solidjs/router"
import { For, Match, Show, Switch, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useCloud } from "@/context/cloud"
import { useTeam } from "@/context/team"
import { useServer } from "@/context/server"
import { usePlatform } from "@/context/platform"
import { openCloudTrial } from "@/utils/open-cloud"
import { showToast } from "@/utils/toast"
import type { CloudProject, CloudTask, CloudTrial } from "@/utils/edge-api-types"

const ROW =
  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-raised-base-hover focus-visible:outline-none focus-visible:bg-surface-raised-base-hover disabled:opacity-50"

/** Team → Project → Task → Trial (worktree) drill-down. Opening a trial provisions its
 *  sandbox and pins a session against it (utils/open-cloud.ts). */
export function DialogCloudProjects() {
  const cloud = useCloud()
  const team = useTeam()
  const server = useServer()
  const platform = usePlatform()
  const navigate = useNavigate()
  const dialog = useDialog()

  const [nav, setNav] = createStore<{
    project?: CloudProject
    task?: CloudTask
    opening: boolean
    progress: string
  }>({ opening: false, progress: "" })

  const projects = useQuery(() => cloud.projectsQuery())
  const tasks = useQuery(() => cloud.tasksQuery(nav.project?.id))
  const trials = useQuery(() => cloud.trialsQuery(nav.task?.id))

  const level = createMemo<"projects" | "tasks" | "trials">(() =>
    !nav.project ? "projects" : !nav.task ? "tasks" : "trials",
  )

  const openTrial = async (trial: CloudTrial) => {
    const project = nav.project
    if (!project || nav.opening) return
    setNav("opening", true)
    setNav("progress", "Checking sandbox…")
    try {
      await openCloudTrial(
        {
          status: (id) => cloud.sandboxStatus(id),
          provision: (id) => cloud.provisionSandbox(id),
          start: (id) => cloud.startSandbox(id),
          connect: (origin) => server.add({ type: "http", http: { url: origin } }),
          navigate: (path) => navigate(path, { replace: true }),
          setActiveTrial: (d) => team.setActiveTrial(d),
          beforeConnect: () => dialog.close(),
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
          skipProvision: trial.skipClientSandboxProvision,
          descriptor: {
            trialId: trial.id,
            trialTitle: trial.title ?? null,
            projectId: project.id,
            projectName: project.name,
            teamId: team.activeTeamId() ?? "",
            taskId: nav.task?.id ?? null,
            taskTitle: nav.task?.title ?? null,
            activatedAt: new Date().toISOString(),
          },
        },
      )
      // dialog already closed via beforeConnect (before the route/server mutation).
    } catch (e) {
      showToast({
        variant: "error",
        title: "Failed to open cloud project",
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setNav("opening", false)
    }
  }

  return (
    <Dialog title="Open Cloud Project">
      <Show when={nav.opening}>
        <div class="flex items-center gap-3 px-3 py-6">
          <Spinner />
          <div class="text-14-mono text-text-weak">{nav.progress || "Opening…"}</div>
        </div>
      </Show>

      <Show when={!nav.opening}>
        {/* Breadcrumb (team is a switcher) */}
        <div class="flex items-center gap-1.5 px-3 pb-2 text-12-mono text-text-weak">
          <DropdownMenu placement="bottom-start" gutter={4}>
            <DropdownMenu.Trigger class="flex items-center gap-1 text-text-strong hover:text-text-base focus-visible:outline-none">
              {team.activeTeam()?.name ?? team.activeTeam()?.displayName ?? "Team"}
              <Icon name="chevron-down" class="size-3 text-icon-weak-base" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content class="min-w-48">
                <For each={team.teams()}>
                  {(t) => (
                    <DropdownMenu.Item
                      onSelect={() => {
                        team.setActiveTeam(t.id)
                        setNav({ project: undefined, task: undefined })
                      }}
                    >
                      <DropdownMenu.ItemLabel>{t.name ?? t.displayName ?? t.id}</DropdownMenu.ItemLabel>
                    </DropdownMenu.Item>
                  )}
                </For>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
          <Show when={nav.project}>
            <Icon name="chevron-right" class="size-3" />
            <button type="button" class="hover:text-text-strong" onClick={() => setNav({ task: undefined })}>
              {nav.project!.name}
            </button>
          </Show>
          <Show when={nav.task}>
            <Icon name="chevron-right" class="size-3" />
            <span class="text-text-strong truncate">{nav.task!.title}</span>
          </Show>
        </div>

        <div class="max-h-[50vh] min-h-[180px] overflow-y-auto px-1 pb-2">
          <Show
            when={team.activeTeamId()}
            fallback={
              <div class="px-3 py-6 text-14-mono text-text-weak">
                {team.loading() ? "Loading teams…" : "No team available — sign in or check your connection."}
              </div>
            }
          >
          <Switch>
            {/* Projects */}
            <Match when={level() === "projects"}>
              <CloudList
                loading={projects.isLoading}
                error={projects.isError}
                empty={(projects.data?.length ?? 0) === 0}
                emptyLabel="No cloud projects in this team."
              >
                <For each={projects.data ?? []}>
                  {(project) => (
                    <button type="button" class={ROW} onClick={() => setNav({ project, task: undefined })}>
                      <div class="min-w-0">
                        <div class="truncate text-14-mono [font-weight:600] text-text-strong">{project.name}</div>
                        <Show when={project.repoFullName}>
                          <div class="truncate text-12-mono text-text-weak">{project.repoFullName}</div>
                        </Show>
                      </div>
                      <Icon name="chevron-right" class="size-4 shrink-0 text-icon-weak-base" />
                    </button>
                  )}
                </For>
              </CloudList>
            </Match>

            {/* Tasks */}
            <Match when={level() === "tasks"}>
              <CloudList
                loading={tasks.isLoading}
                error={tasks.isError}
                empty={(tasks.data?.length ?? 0) === 0}
                emptyLabel="No tasks in this project."
              >
                <For each={tasks.data ?? []}>
                  {(task) => (
                    <button type="button" class={ROW} onClick={() => setNav({ task })}>
                      <div class="min-w-0">
                        <div class="truncate text-14-mono text-text-strong">{task.title}</div>
                        <Show when={task.status}>
                          <div class="truncate text-12-mono text-text-weak">{task.status}</div>
                        </Show>
                      </div>
                      <Icon name="chevron-right" class="size-4 shrink-0 text-icon-weak-base" />
                    </button>
                  )}
                </For>
              </CloudList>
            </Match>

            {/* Trials / worktrees */}
            <Match when={level() === "trials"}>
              <CloudList
                loading={trials.isLoading}
                error={trials.isError}
                empty={(trials.data?.length ?? 0) === 0}
                emptyLabel="No worktrees for this task."
              >
                <For each={trials.data ?? []}>
                  {(trial) => (
                    <button type="button" class={ROW} onClick={() => void openTrial(trial)}>
                      <div class="min-w-0">
                        <div class="truncate text-14-mono [font-weight:600] text-text-strong">
                          {trial.agentOSBranch || trial.title || trial.id}
                        </div>
                        <div class="truncate text-12-mono text-text-weak">
                          {[trial.type, trial.status].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Icon name="arrow-right" class="size-4 shrink-0 text-icon-weak-base" />
                    </button>
                  )}
                </For>
              </CloudList>
            </Match>
          </Switch>
          </Show>
        </div>
      </Show>
    </Dialog>
  )
}

function CloudList(props: {
  loading: boolean
  error: boolean
  empty: boolean
  emptyLabel: string
  children: import("solid-js").JSX.Element
}) {
  return (
    <Switch fallback={props.children}>
      <Match when={props.loading}>
        <div class="flex items-center gap-3 px-3 py-6">
          <Spinner />
          <div class="text-14-mono text-text-weak">Loading…</div>
        </div>
      </Match>
      <Match when={props.error}>
        <div class="px-3 py-6 text-14-mono text-text-weak">Failed to load. Check your connection and try again.</div>
      </Match>
      <Match when={props.empty}>
        <div class="px-3 py-6 text-14-mono text-text-weak">{props.emptyLabel}</div>
      </Match>
    </Switch>
  )
}
