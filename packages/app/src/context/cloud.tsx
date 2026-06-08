import { createSimpleContext } from "@opencode-ai/ui/context"
import { useEdgeApi } from "./edge-api"
import { useTeam } from "./team"
import type { CloudProject, CloudTask, CloudTrial, CreateTrialInput } from "@/utils/edge-api-types"

/**
 * Cloud data layer over the Edge API, team-scoped via the active team. Exposes
 * @tanstack/solid-query option builders (call inside a component with `useQuery(() => ...)`)
 * and imperative sandbox helpers for the open-cloud flow. Query keys carry teamId so a team
 * switch refetches; TTLs mirror vscode-cde (projects 60s, tasks 30s, trials 15s).
 */
export const { use: useCloud, provider: CloudProvider } = createSimpleContext({
  name: "Cloud",
  init: () => {
    const edge = useEdgeApi()
    const team = useTeam()
    const teamId = () => team.activeTeamId()

    return {
      projectsQuery: () => ({
        queryKey: ["cloud", "projects", teamId()] as const,
        queryFn: (): Promise<CloudProject[]> => edge.projects.list(teamId()!),
        enabled: !!teamId(),
        staleTime: 60_000,
      }),
      tasksQuery: (projectId: string | undefined) => ({
        queryKey: ["cloud", "tasks", teamId(), projectId] as const,
        queryFn: (): Promise<CloudTask[]> =>
          edge.tasks.list(projectId!, { teamId: teamId() }).then((page) => page.tasks),
        enabled: !!teamId() && !!projectId,
        staleTime: 30_000,
      }),
      trialsQuery: (taskId: string | undefined) => ({
        queryKey: ["cloud", "trials", teamId(), taskId] as const,
        queryFn: (): Promise<CloudTrial[]> => edge.tasks.trials(taskId!, { teamId: teamId() }),
        enabled: !!teamId() && !!taskId,
        staleTime: 15_000,
      }),

      // Create a new worktree (trial) under a task, scoped to the active team. The
      // git worktree itself is created server-side during sandbox provisioning.
      createTrial: (input: CreateTrialInput) => edge.trials.create(input, { teamId: teamId() }),

      // Imperative sandbox helpers (open-cloud flow, Phase 5).
      sandboxStatus: (trialId: string) => edge.trials.sandboxStatus(trialId, { teamId: teamId() }),
      provisionSandbox: (trialId: string) => edge.trials.provisionSandbox(trialId, { teamId: teamId() }),
      startSandbox: (trialId: string) => edge.trials.startSandbox(trialId, { teamId: teamId() }),
    }
  },
})
