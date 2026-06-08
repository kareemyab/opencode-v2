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
  readonly trialCount?: number
  readonly createdAt?: string
  readonly updatedAt?: string
}

export interface CloudTaskPage {
  readonly tasks: CloudTask[]
  readonly cursor?: string
  readonly hasMore: boolean
}

/**
 * Input to create a new cloud worktree (a Trial), mirroring deno-stealth's
 * createTrialSchema (POST /api/v1/trials) and CDE Web's "Launch CDE" start-trial
 * payload. Git auth during provisioning is handled entirely server-side by
 * deno-stealth's GIT_ASKPASS shim (fetches a live credential from id-orgn
 * /api/git/credentials per prompt, no token at rest), so the desktop sends NO
 * GitHub token here.
 */
export interface CreateTrialInput {
  readonly projectId: string
  readonly title: string
  readonly taskId?: string
  readonly type?: "CODE" | "RESEARCH" | "ASK"
  readonly chatMode?: string
  readonly baseBranch?: string
  readonly repoFullName?: string
  readonly repoUrl?: string
  /** Suggested git branch for the worktree; backend may normalize/dedupe it. */
  readonly agentOSBranch?: string
  readonly mainModel?: string
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
  readonly activatedAt: string
}
