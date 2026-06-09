/**
 * Types for the Origin Edge Backend API (deno-stealth, https://api.orgn.com/api/v1 and
 * id-orgn https://id.orgn.com/api/user/*). Field sets mirror the vscode-cde client
 * (cdeProjectsState.ts) and deno-api.md. A "worktree" is a Trial (trial + sandbox + branch).
 */

export interface Team {
  readonly id: string
  readonly name: string
  readonly displayName?: string | null
  readonly slug?: string | null
  readonly logo?: string | null
  readonly role?: string | null
  readonly personal?: boolean
}

/** Team credit balance from id-orgn (authoritative billing ledger): `GET /api/user/teams/:id/credits`. */
export interface TeamCredits {
  readonly balance: number
  readonly updatedAt?: string | null
  readonly lowBalanceThreshold?: number
}

export interface CloudProject {
  readonly id: string
  readonly name: string
  readonly description?: string | null
  readonly teamId?: string | null
  readonly repoFullName?: string | null
  readonly repoUrl?: string | null
  readonly defaultBranch?: string | null
  readonly archived?: boolean
  readonly deleted?: boolean
  readonly createdAt?: string
  readonly updatedAt?: string
  readonly sandboxProvider?: "codesandbox" | "daytona" | null
}

export interface CloudTask {
  readonly id: string
  readonly title: string
  readonly description?: string | null
  readonly status?: string
  readonly priority?: number
  readonly projectId?: string | null
  readonly parentTaskId?: string | null
  readonly assignedToId?: string | null
  readonly trialCount?: number
  readonly createdAt?: string
  readonly updatedAt?: string
}

/** A team/project label (`GET /tasks/labels/counts`) — used for the task filter. */
export interface CloudLabel {
  readonly id: string
  readonly name: string
  readonly color?: string | null
  readonly count?: number
}

export interface CloudTaskPage {
  readonly tasks: CloudTask[]
  readonly cursor?: string
  readonly hasMore: boolean
}

/** Full task as returned by `GET /tasks/:id` (deno-stealth `getTask`) — list fields + metadata. */
export interface CloudTaskDetail extends CloudTask {
  readonly assignedToId?: string | null
  readonly estimate?: number | null
  readonly milestoneId?: string | null
  readonly cycleId?: string | null
  readonly featureId?: string | null
  readonly source?: string | null
  readonly archived?: boolean
  /** Some enrich the row with an assignee object; render defensively if present. */
  readonly assignee?: { id?: string; email?: string | null; name?: string | null; image?: string | null } | null
  readonly labels?: Array<{ id: string; name: string; color?: string | null }>
}

/** A task comment (`GET /tasks/:id/comments`). `body` is the markdown content. */
export interface CloudComment {
  readonly id: string
  readonly body: string
  readonly createdAt?: string
  readonly updatedAt?: string
  readonly authorUserId?: string | null
  readonly authorEmail?: string | null
}

/** A task activity-log entry (`GET /tasks/:id/activity`). */
export interface CloudActivity {
  readonly id: string
  readonly action: string
  readonly field?: string | null
  readonly oldValue?: string | null
  readonly newValue?: string | null
  readonly metadata?: string | null
  readonly createdAt?: string
  readonly user?: {
    readonly id?: string
    readonly email?: string | null
    readonly name?: string | null
    readonly image?: string | null
    readonly githubUsername?: string | null
  } | null
}

/** A Trial == a worktree (trial record + its sandbox + its git branch). */
export interface CloudTrial {
  readonly id: string
  readonly ticketId?: string | null // taskId
  readonly title?: string | null
  readonly status?: string // running|completed|failed|stopped|initializing|archived
  readonly type?: "RESEARCH" | "CODE" | "ASK" | string
  readonly createdAt?: string
  readonly updatedAt?: string
  readonly agentOSBranch?: string | null // git branch == worktree branch
  readonly baseBranch?: string | null
  readonly repoFullName?: string | null
  readonly prUrl?: string | null
  readonly prNumber?: number | null
  readonly opencodeSessionId?: string | null
  readonly skipClientSandboxProvision?: boolean
}

/** Input for creating a trial (worktree). Subset of deno-stealth's `createTrialSchema`. */
export interface CreateTrialInput {
  readonly projectId: string
  readonly title: string
  readonly taskId?: string
  readonly type?: "RESEARCH" | "CODE" | "ASK" | string
  readonly baseBranch?: string
  readonly repoFullName?: string
  readonly repoUrl?: string
  readonly chatMode?: string
  readonly agentId?: string
  /** Suggested git branch for the worktree; backend may normalize/dedupe it. */
  readonly agentOSBranch?: string
  readonly mainModel?: string
}

/** Input for creating a task (subset of deno-stealth's `createTaskSchema`). */
export interface CreateTaskInput {
  readonly projectId: string
  readonly title: string
  readonly description?: string
  readonly status?: string
  readonly priority?: number
  readonly assignedToId?: string
}

/** A team member (`GET /teams/:teamId/members`) — used for the assignee picker. */
export interface CloudMember {
  readonly userId?: string
  readonly role?: string | null
  readonly user?: {
    readonly id: string
    readonly email?: string | null
    readonly name?: string | null
    readonly image?: string | null
  }
}

/** Returned by sandbox status/provision — the bridge to the opencode origin. */
export interface CloudSandboxStatus {
  readonly trialId?: string
  readonly projectId?: string | null
  readonly csbID?: string | null // sandbox id used by daytonaOpencodeOrigin()
  readonly opencodeURL?: string | null // full sandbox opencode origin/preview url
  readonly sandboxStatus?: string | null
  readonly sandboxProvider?: "codesandbox" | "daytona" | null
  readonly hasSandbox?: boolean
  readonly isTrialOwned?: boolean
  readonly workspacePath?: string | null // defaults to /home/daytona/project
  readonly ready?: boolean
}

/** Persisted active cloud worktree (mirror of vscode-cde ActiveTrialDescriptor). */
export interface ActiveTrialDescriptor {
  readonly trialId: string
  readonly trialTitle: string | null
  readonly projectId: string
  readonly projectName: string
  readonly teamId: string
  readonly taskId: string | null
  readonly taskTitle: string | null
  readonly workspacePath?: string | null
  readonly csbID?: string | null
  /**
   * ServerConnection key of the pinned sandbox (its normalized opencode origin). Lets the UI tell
   * "we're inside this trial's session" (active server === serverKey) apart from local sessions,
   * and resume the worktree by re-activating that server instead of losing it.
   */
  readonly serverKey?: string
  readonly activatedAt: string
}
