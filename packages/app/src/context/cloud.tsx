import { createSimpleContext } from "@opencode-ai/ui/context"
import { useEdgeApi } from "./edge-api"
import { useTeam } from "./team"
import type {
  CloudActivity,
  CloudComment,
  CloudLabel,
  CloudMember,
  CloudProject,
  CloudTask,
  CloudTaskDetail,
  CloudTrial,
  CreateTaskInput,
  CreateTrialInput,
  TeamCredits,
} from "@/utils/edge-api-types"

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
      tasksQuery: (projectId: string | undefined, opts?: { labelIds?: string[] }) => {
        const labelIds = opts?.labelIds?.length ? [...opts.labelIds].sort().join(",") : undefined
        return {
          queryKey: ["cloud", "tasks", teamId(), projectId, labelIds] as const,
          queryFn: (): Promise<CloudTask[]> =>
            edge.tasks.list(projectId!, { teamId: teamId(), labelIds }).then((page) => page.tasks),
          enabled: !!teamId() && !!projectId,
          staleTime: 30_000,
        }
      },
      labelsQuery: (projectId: string | undefined) => ({
        queryKey: ["cloud", "labels", teamId(), projectId] as const,
        queryFn: (): Promise<CloudLabel[]> => edge.tasks.labels(projectId!, { teamId: teamId() }),
        enabled: !!teamId() && !!projectId,
        staleTime: 300_000,
      }),
      trialsQuery: (taskId: string | undefined) => ({
        queryKey: ["cloud", "trials", teamId(), taskId] as const,
        queryFn: (): Promise<CloudTrial[]> => edge.tasks.trials(taskId!, { teamId: teamId() }),
        enabled: !!teamId() && !!taskId,
        staleTime: 15_000,
      }),
      taskQuery: (taskId: string | undefined) => ({
        queryKey: ["cloud", "task", teamId(), taskId] as const,
        queryFn: (): Promise<CloudTaskDetail> => edge.tasks.get(taskId!, { teamId: teamId() }),
        enabled: !!teamId() && !!taskId,
        staleTime: 15_000,
      }),
      commentsQuery: (taskId: string | undefined) => ({
        queryKey: ["cloud", "comments", teamId(), taskId] as const,
        queryFn: (): Promise<CloudComment[]> => edge.tasks.comments(taskId!, { teamId: teamId() }),
        enabled: !!teamId() && !!taskId,
        staleTime: 15_000,
      }),
      activityQuery: (taskId: string | undefined) => ({
        queryKey: ["cloud", "activity", teamId(), taskId] as const,
        queryFn: (): Promise<CloudActivity[]> => edge.tasks.activity(taskId!, { teamId: teamId() }),
        enabled: !!teamId() && !!taskId,
        staleTime: 15_000,
      }),
      membersQuery: () => ({
        queryKey: ["cloud", "members", teamId()] as const,
        queryFn: (): Promise<CloudMember[]> => edge.teams.members(teamId()!, { teamId: teamId() }),
        enabled: !!teamId(),
        staleTime: 300_000,
      }),
      // Keyed by the explicit team (not the active one) so the team switcher can show a
      // balance for every team it lists. id-orgn billing ledger; cached 60s.
      teamCreditsQuery: (id: string | undefined) => ({
        queryKey: ["cloud", "credits", id] as const,
        queryFn: (): Promise<TeamCredits> => edge.teams.credits(id!),
        enabled: !!id,
        staleTime: 60_000,
      }),

      // Imperative sandbox helpers (open-cloud flow, Phase 5).
      sandboxStatus: (trialId: string) => edge.trials.sandboxStatus(trialId, { teamId: teamId() }),
      provisionSandbox: (trialId: string) => edge.trials.provisionSandbox(trialId, { teamId: teamId() }),
      startSandbox: (trialId: string) => edge.trials.startSandbox(trialId, { teamId: teamId() }),
      /** Create a new trial (worktree) in a project; provision/open separately. */
      createTrial: (input: CreateTrialInput) => edge.trials.create(input, { teamId: teamId() }),
      /** Create a new task in a project. */
      createTask: (input: CreateTaskInput) => edge.tasks.create(input, { teamId: teamId() }),
      /** Post a comment on a task. */
      addComment: (taskId: string, body: string) => edge.tasks.addComment(taskId, body, { teamId: teamId() }),
      /** Enhance a task's description with AI; persists and returns the enhanced text + updated task. */
      enhanceTask: (taskId: string, input?: string) => edge.tasks.enhance(taskId, input, { teamId: teamId() }),
    }
  },
})
