I now have everything verified. I have confirmed the critical architecture details, the exact provider stack, the open mechanism, and the key risk: the `target`/`__api` gateway is web-only. Let me write the blueprint.

# PORT BLUEPRINT — Orgn Cloud Integration into opencode-v2 (Electron + SolidJS)

This blueprint is grounded in the actual target code, not just the supplied specs. Where the supplied specs were imprecise or wrong about the target, I correct them inline and cite the real file:line.

---

## 1. How it works in vscode-cde (end-to-end)

The vscode-cde flow is: **id-orgn OAuth (PKCE) → access token → Edge API (`/api/v1`) → teams → projects → tasks → trials → sandbox → remote-attach.**

1. **Auth.** F1 `workbench.action.idOrgn.signIn` runs Authorization-Code + PKCE (S256). Redirect URI is `{scheme}://oxyz.id-orgn-authentication/did-authenticate`; authorize at `${idOrgn.url}/api/auth/oauth2/authorize`, token at `/api/auth/oauth2/token` (study:auth-idorgn §1.2). The full `IdOrgnTokenSet` (accessToken/idToken/refreshToken/expiresAt) is stored in VSCode SecretStorage under `id-orgn.sessions` (§3.1–3.2), with proactive refresh 5 min before expiry (§3.3).

2. **Edge auth method.** Edge API calls in the **first-party app use the id-orgn JWT access token as a Bearer**, not an api-key: `Authorization: Bearer ${accessToken}` plus `X-Selected-Team-ID: ${teamId}` and `Accept: application/json` (study:auth-idorgn §5.1–5.2, study:edge-api §2). API-key (`sk_...` / `X-API-Key`) is the *external integration* path (e.g. MCP), not what the editor uses. A 401 triggers a reactive token refresh + single retry (§5.1).

3. **Teams.** `GET /api/user/teams` (proxied via `id-orgn.getTeams`), cached 60 s, deduped in-flight. Active team persisted under `idOrgn.selectedTeamId` (APPLICATION/USER), defaulting to `teams[0]` (study:team-usermenu §1–2). Switching team writes the key and fires storage-change listeners → balance + project list re-fetch. **Note the base-URL asymmetry:** teams/credits go to `${idOrgn.url}/api/user/...`, whereas projects/tasks/trials go to `${cde.apiUrl}/api/v1/...`. (study:team-usermenu §2 vs study:edge-api §4.)

4. **Projects → Tasks → Trials.** All under `${cde.apiUrl}/api/v1`, team-scoped via `X-Selected-Team-ID`: `GET /projects?teamId=`, `GET /tasks?projectId=&limit=100&cursor=`, `GET /tasks/:id/trials` (study:edge-api §4). Envelope is `{success, data}` (or sometimes bare) and is unwrapped by `unwrapCdeApiEnvelope` (study:edge-api §6). A **worktree IS a trial** + its sandbox + its git branch (`agentOSBranch`) (study:projects-model §4).

5. **OPEN (the exact mechanism).** Clicking a trial calls `gateService.activate(ActiveTrialDescriptor)` (study:projects-ui §2). The gate then:
   - `cde.probeTrialSandbox` (fast path) → else `cde.provisionTrialSandbox` (Daytona) → poll `sandbox/status` until running → poll until OpenCode HTTP answers → SSH probe → `cde.prewarmRemoteServer`.
   - Records the descriptor for the remote resolver (`cde.recordActiveTrialForResolver`) and calls `vscode.openFolder` with **`vscode-remote://cde-ssh+{encodeURIComponent(trialId)}/{workspacePath}`**, `{forceReuseWindow:true}` (study:trial-gate-open §1, §5). So vscode-cde opens cloud projects over an **SSH remote authority**, with the cde-server running inside the Daytona sandbox.

**Key takeaway for the port:** vscode-cde connects via SSH-remote. opencode-v2 has **no SSH-remote-authority machinery**; it connects to a sandbox's *opencode HTTP server* through a **same-origin proxy** (`/__api` + `X-OpenCode-Target-URL`). Section 6 reconciles this.

---

## 2. Target architecture mapping

For each concern: the electron file to create/extend and the existing primitive to reuse.

### (a) Expose the id-orgn access token from auth.tsx
- **EXTEND** `packages/app/src/context/auth.tsx`. Today it stores tokens only transiently inside `handleCallback` and discards everything but the id-token-derived user (`auth.tsx:60-68`). The `DesktopTokenSet` already carries `accessToken`/`refreshToken`/`expiresIn` (`utils/id-orgn-auth.ts:59-64,90-95`) — they are simply dropped.
- Add an in-memory `tokens` signal, store the full set on callback, expose `accessToken()` and an async `getAccessToken()` (returns current, refreshing if near expiry). Reuse the existing PKCE helpers; add a `refreshTokens()` using the same `/api/auth/oauth2/token` endpoint with `grant_type=refresh_token` (new tiny helper in `utils/id-orgn-auth.ts`).
- Return shape becomes: `{ enabled, user, signedIn, signIn, signOut, accessToken, getAccessToken }`.

### (b) Typed Edge API client module
- **CREATE** `packages/app/src/utils/edge-api.ts` — a pure, framework-free client (mirrors how `utils/server.ts` is a pure SDK factory). It does base-URL resolution, header assembly (Bearer + `X-Selected-Team-ID`), envelope unwrap, retry, and typed endpoint methods. It receives a `getToken: () => Promise<string|undefined>` and a `getTeamId: () => string|undefined` so it stays decoupled from Solid.
- **CREATE** `packages/app/src/context/edge-api.tsx` — thin `createSimpleContext` wrapper that wires `useAuth().getAccessToken` and `useTeam().activeTeamId` into the client. (Pattern: every context here is `createSimpleContext({name, init})`, e.g. `global.tsx:12`.)
- Reuse `platform.fetch` for non-loopback HTTPS so requests aren't subject to webview CORS (the same reason `server-sdk.tsx:29-33` swaps in `platform.fetch` for remote http). Edge API is cross-origin HTTPS → **must** use `platform.fetch`.

### (c) Team context (+persisted active team + switch)
- **CREATE** `packages/app/src/context/team.tsx` via `createSimpleContext`.
- Reuse the **`persisted()`** primitive (`utils/persist.ts:524`) with `Persist.global("selectedTeamId")` for APPLICATION-scope persistence — exactly mirroring `idOrgn.selectedTeamId` semantics (study:team-usermenu §1). This is the same primitive `server.tsx:227-237` uses for server state.
- Load teams with a Solid `createResource` gated on `auth.signedIn()` (the spec's `createResource(() => cond ? api() : null)` idiom, also used in `app.tsx:199`). Default `activeTeam = teams[0]` if persisted id is absent/stale (study:team-usermenu §1). Expose `teams`, `activeTeamId`, `activeTeam`, `setActiveTeam`.

### (d) Cloud Projects/Tasks/Trials/Worktrees data layer
- **CREATE** `packages/app/src/context/cloud.tsx` via `createSimpleContext`.
- Reuse **`@tanstack/solid-query`** (`useQuery`, already used in `home.tsx:164` and provided app-wide by `QueryProvider` in `app.tsx:86-97`). Query keys carry `teamId`/`projectId`/`taskId` so a team switch invalidates cleanly. Use the TTLs from study:edge-api §7 as `staleTime` (projects 60 s, tasks 30 s, trials 15 s).
- Methods: `projects(teamId)`, `tasks(projectId)`, `trials(taskId)`, plus `provisionSandbox(trialId)` / `sandboxStatus(trialId)` mutations/queries used by the open flow.

### (e) "Open Cloud Project" UI in the redesigned home screen
- **EXTEND** `packages/app/src/pages/home.tsx` (`HomeDesign`, starts `home.tsx:122`). Add an "Open Cloud Project" affordance next to the existing project actions. Reuse `useDialog().show()` (`home.tsx:126`, pattern at `home.tsx:283-285,327-330`).
- **CREATE** `packages/app/src/components/dialog-cloud-projects.tsx` — a drill-down picker (Team → Project → Task → Trial/Worktree). Reuse the existing dialog component conventions (`DialogSelectDirectory`, `DialogSelectServer`) and `ButtonV2`/`IconButtonV2`/`MenuV2` already imported into home.
- Gate the entry button on `auth.signedIn() && !!team.activeTeam()`.

### (f) The open-cloud mechanism
- **CREATE** `packages/app/src/util/open-cloud.ts` (helper) + wire from the dialog.
- **Reuse the existing `/launch` path** (`pages/launch.tsx:38-46`): build `daytonaOpencodeOrigin(sandboxId, port)` (`brand/constants.ts:40`), pin a `ServerConnection.Http` with `{ http: { url: baseUrl, target } }` via `server.add(...)` (`server.tsx:262`), then `navigate(\`/${base64Encode(dir)}/session\`)`. The `target` field (`server.tsx:150-161`) and the `X-OpenCode-Target-URL` header injection in `utils/server.ts:44-47` already exist and are exactly the CDE-Web daytona-proxy mechanism.
- **CRITICAL CORRECTION to study:target-electron §4:** that mechanism only works **same-origin against the app-gate Worker** (`function/src/app-gate.ts:201-262`), which (i) authorizes via the `oc.session` cookie and (ii) mints the Daytona preview token server-side (`function/src/daytona.ts:46-81`). In Electron there is **no same-origin Worker** (`location.origin` is `app://`/`file://`/dev-server) — `baseUrl = location.origin + "/__api"` will 404. The trial's sandbox URL the Edge API returns (`opencodeURL`) is a private Daytona preview gated by Dex/preview-token; the renderer can't mint that token. **The desktop open-cloud flow must therefore route through a Worker/proxy origin, or the Edge API must return a ready-to-use preview URL.** See §5 and §7 for the two viable options.

---

## 3. Data model (TS interfaces)

Place in `packages/app/src/utils/edge-api-types.ts` (consumed by the client + contexts). Field sets taken verbatim from study:edge-api §4 and study:projects-model §1.

```ts
export interface Team {
  readonly id: string
  readonly name: string
  readonly displayName?: string
  readonly slug?: string
  readonly logo?: string | null
  readonly role?: string
}

export interface UserProfile {
  readonly id: string
  readonly email?: string | null
  readonly displayName?: string | null
  readonly githubUsername?: string | null
  readonly avatar?: string | null
  readonly image?: string | null
  readonly profileImageUrl?: string | null
}

export interface CloudProject {
  readonly id: string
  readonly name: string
  readonly description?: string | null
  readonly teamId: string
  readonly repoFullName?: string | null
  readonly repoUrl?: string | null
  readonly defaultBranch?: string | null
  readonly archived: boolean
  readonly deleted: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly sandboxStatus?: string | null
  readonly sandboxProvider?: "codesandbox" | "daytona" | null
}

export interface CloudTask {
  readonly id: string
  readonly title: string
  readonly description?: string | null
  readonly status: string
  readonly priority: number
  readonly projectId?: string | null
  readonly assigneeId?: string | null
  readonly assignedToId?: string | null
  readonly parentTaskId?: string | null
  readonly subtaskCount?: number
  readonly commentCount?: number
  readonly trialCount?: number
  readonly assignee?: UserProfile | null
  readonly assignedTo?: UserProfile | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CloudTaskPage {
  readonly tasks: CloudTask[]
  readonly cursor?: string
  readonly hasMore: boolean
}

// A Trial IS a worktree (trial record + sandbox + git branch).
export interface CloudTrial {
  readonly id: string
  readonly ticketId: string // taskId
  readonly title: string | null
  readonly status: string // running|completed|failed|stopped|initializing|archived
  readonly type: "RESEARCH" | "CODE" | "ASK"
  readonly createdAt: string
  readonly updatedAt: string
  readonly timespent?: number | null
  readonly chatUrl?: string | null
  readonly agentOSBranch?: string | null // git branch == worktree branch
  readonly baseBranch?: string | null
  readonly repoFullName?: string | null
  readonly prUrl?: string | null
  readonly prNumber?: number | null
  readonly prMerged?: boolean | null
  readonly prMergedAt?: string | null
  readonly agentId?: string | null
  readonly mainModel?: string | null
  readonly opencodeSessionId?: string | null
  readonly chatMode?: string | null
  readonly skipClientSandboxProvision?: boolean
}

// Returned by sandbox status/provision — the bridge to the opencode origin.
export interface CloudSandboxStatus {
  readonly trialId: string
  readonly projectId: string
  readonly csbID?: string | null        // sandbox id used by daytonaOpencodeOrigin()
  readonly opencodeURL?: string | null  // full sandbox opencode origin/preview url
  readonly sandboxStatus?: string | null
  readonly sandboxProvider?: "codesandbox" | "daytona" | null
  readonly hasSandbox?: boolean
  readonly isTrialOwned?: boolean
  readonly workspacePath?: string | null // defaults to /home/daytona/project
}

export interface CloudSession {
  readonly id: string
  readonly trialId?: string
  readonly status: string
  readonly createdAt: string
  readonly updatedAt: string
}

// Mirror of vscode-cde ActiveTrialDescriptor (study:projects-model §5) — used to
// persist the active cloud worktree and to seed the open flow.
export interface ActiveTrialDescriptor {
  readonly trialId: string
  readonly trialTitle: string | null
  readonly projectId: string
  readonly projectName: string
  readonly teamId: string
  readonly taskId: string | null
  readonly taskTitle: string | null
  readonly type?: "CODE" | "RESEARCH" | "ASK"
  readonly chatUrl?: string | null
  readonly activatedAt: string
  readonly skipClientSandboxProvision?: boolean
}

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiError { success: false; error: { code: string; message: string; details?: unknown } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError
```

---

## 4. Edge API client — method signatures

`packages/app/src/utils/edge-api.ts`. Pure factory, no Solid. Two base URLs (study:team-usermenu §2 vs study:edge-api §1): `apiUrl` (`${API_URL}` = `https://api.orgn.com`, `brand/constants.ts:22`) for `/api/v1`, and `idUrl` (`${ID_URL}`, `brand/constants.ts:20`) for `/api/user/*`.

```ts
export interface EdgeClientConfig {
  apiUrl: string                                   // brand API_URL, /api/v1
  idUrl: string                                    // brand ID_URL, /api/user
  getToken: () => Promise<string | undefined>      // auth.getAccessToken
  fetch?: typeof fetch                             // platform.fetch (REQUIRED on desktop)
}

export interface EdgeRequestOpts { teamId?: string; signal?: AbortSignal }

export function createEdgeClient(config: EdgeClientConfig) {
  // internal:
  //   request<T>(base, path, { method, query, body, teamId, signal }): Promise<T>
  //     - headers: Authorization: Bearer <token>, Accept: application/json,
  //       Content-Type: application/json (on body), X-Selected-Team-ID: <teamId?>
  //     - retry on 408/425/429/500/502/503/504 (4 attempts, 1.5s*attempt) [edge-api §6]
  //     - on 401: await config.getToken(force=true) once, replay once [auth-idorgn §5.1]
  //     - unwrap { success, data } | bare [edge-api §6]
  //     - throw EdgeApiError(code, message, status) on !ok
  return {
    teams: {
      list(opts?: EdgeRequestOpts): Promise<Team[]>            // ID_URL /api/user/teams
      balance(teamId: string): Promise<{ balance: number; updatedAt: string | null; lowBalanceThreshold?: number }>
    },
    projects: {
      list(teamId: string, opts?: { archived?: boolean; deleted?: boolean }): Promise<CloudProject[]>  // /api/v1/projects?teamId=
      get(id: string, opts: EdgeRequestOpts): Promise<CloudProject>
      branches(projectId: string, opts: EdgeRequestOpts): Promise<string[]>
    },
    tasks: {
      list(projectId: string, opts: EdgeRequestOpts & { limit?: number; cursor?: string; status?: string; assignedTo?: string; search?: string }): Promise<CloudTaskPage>
      trials(taskId: string, opts: EdgeRequestOpts): Promise<CloudTrial[]>   // /api/v1/tasks/:id/trials
      create(input: { projectId: string; title: string; ... }, opts: EdgeRequestOpts): Promise<CloudTask>
    },
    trials: {
      get(id: string, opts: EdgeRequestOpts): Promise<CloudTrial>
      create(input: { projectId: string; title: string; taskId: string; type: "CODE"; baseBranch?: string; repoFullName?: string; repoUrl?: string }, opts: EdgeRequestOpts): Promise<CloudTrial>
      provisionSandbox(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus>   // POST /api/v1/trials/:id/provision-sandbox
      sandboxStatus(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus>      // GET  /api/v1/trials/:id/sandbox/status
      startSandbox(id: string, opts: EdgeRequestOpts): Promise<CloudSandboxStatus>       // POST /api/v1/trials/:id/sandbox/start
    },
  }
}
```

**Base URL resolution:** read from `import.meta.env.VITE_ORGN_API_URL ?? API_URL` and `VITE_ID_ORGN_URL ?? ID_URL`, mirroring how `auth.tsx:35-36` resolves id-orgn URL with env override.

**Auth header (answer to the explicit question): Bearer JWT, not api-key.** The desktop app is first-party, so it carries `Authorization: Bearer <id-orgn access token>` + `X-Selected-Team-ID` exactly like vscode-cde's editor (study:auth-idorgn §5.2). The `sk_`/`X-API-Key` mode is out of scope.

---

## 5. Open-cloud-project flow (step-by-step)

Mapped onto opencode-v2's remote-connect path (`pages/launch.tsx`, `server.add` with `target`).

**Trigger:** user clicks a trial/worktree row in `DialogCloudProjects`.

1. **Build descriptor.** Construct `ActiveTrialDescriptor` from the selected project/task/trial; persist it under `Persist.global("activeTrial")` (mirror of `cde.activeTrial`, study:trial-gate-open §"State Persistence").
2. **Probe / provision.** `cloud.sandboxStatus(trialId)`. If not ready and `!skipClientSandboxProvision`, call `cloud.provisionSandbox(trialId)` and poll `sandboxStatus` until `sandboxStatus ∈ {running,active,started}` and `opencodeURL`/`csbID` present (poll budget per study:trial-gate-open §5: ~2 min running, ~1 min agent-ready). Show progress in the dialog (reuse `Spinner` already imported in home).
3. **Resolve the opencode origin.** Prefer the Edge-returned `opencodeURL`; else reconstruct via `daytonaOpencodeOrigin(csbID, DAYTONA_OPENCODE_PORT)` (`brand/constants.ts:40`). Resolve `workspacePath` (default `/home/daytona/project`, study:trial-gate-open §1).
4. **Pick the proxy base URL (the load-bearing decision).**
   - **Web build:** `baseUrl = server.current?.http.url ?? \`${location.origin}/__api\`` and `target = opencodeOrigin` — identical to `launch.tsx:38-46`. The app-gate Worker authorizes via cookie and mints the Daytona preview token (`app-gate.ts:212-230`, `daytona.ts:71-81`).
   - **Desktop build:** there is no same-origin Worker. Use the **hosted gateway origin** as the proxy: `baseUrl = \`${APP_URL}/__api\`` (`APP_URL = https://cde.orgn.com`, `brand/constants.ts:24`) with `target = opencodeOrigin`. Because this is cross-origin HTTPS, requests go through `platform.fetch` (`server-sdk.tsx:31-33`), and the Worker still needs an `oc.session` cookie or Bearer to authorize the `/__api` proxy — **this is the open risk** (see §7). If the Edge API can instead return a *public/tokenized* `opencodeURL`, set `baseUrl = opencodeURL` directly (no `target`, no Worker) and skip the gateway.
5. **Pin the server + navigate.** Exactly the launch.tsx ordering — navigate first, then `server.add` so the route is replaced before the `ServerKey` `keyed` boundary (`app.tsx:298-305`) remounts the server-scoped subtree:
   ```ts
   navigate(`/${base64Encode(workspacePath)}/session`, { replace: true })
   server.add({ type: "http", http: { url: baseUrl, target: opencodeOrigin } })
   ```
   `server.add` sets this connection active (`server.tsx:274`) and its key includes the target (`server.tsx:197-203`) so each sandbox is a distinct scoped server.
6. **Session opens.** `ServerKey` remounts → `ServerSDKProvider`/`ServerSyncProvider` build an SDK against `baseUrl` with `X-OpenCode-Target-URL: opencodeOrigin` injected (`utils/server.ts:44-47`). `ConnectionGate` (`app.tsx:191`) health-checks; on success the directory/session route renders against the sandbox's opencode server. No session id ⇒ fresh session (same as launch).
7. **(Optional) deep-link parity.** The same outcome is reachable from `orgn://open-sandbox?sandbox=<csbID>&dir=<path>` which already parses to `{sandbox,dir,port,session,prompt}` (`deep-links.ts:129-146`); the cloud dialog can simply synthesize that and reuse the launch route, keeping one code path.

---

## 6. Ordered implementation plan (phased, file-by-file)

Each phase is independently shippable and verifiable. Reuse `createSimpleContext`, `persisted()`, `useQuery`, `server.add`/`target`, `platform.fetch`.

**Phase 0 — Expose the access token (no UI).**
- `utils/id-orgn-auth.ts`: add `refreshTokens(config, refreshToken)` (POST token endpoint, `grant_type=refresh_token`).
- `context/auth.tsx`: store full `DesktopTokenSet` in a signal on `handleCallback`; add `accessToken()` + `getAccessToken()` (refresh-if-near-expiry); clear on `signOut`. *Verify:* console-log a token after sign-in; existing view-gate still works.

**Phase 1 — Edge client + provider.**
- `utils/edge-api-types.ts` (§3), `utils/edge-api.ts` (§4), `context/edge-api.tsx`.
- Add `<EdgeAPIProvider>` to the stack **inside** `AuthProvider` (so `useAuth` is available) — wrap around `GlobalProvider` in `app.tsx:316-352`. *Verify:* unit-test `request()` envelope-unwrap + retry; one manual `teams.list()` call logs teams.

**Phase 2 — Team context + switch.**
- `context/team.tsx` with `persisted(Persist.global("selectedTeamId"), ...)` + `createResource` teams. Add `<TeamProvider>` directly under `<EdgeAPIProvider>`.
- (Edge client's `getTeamId` now reads `useTeam().activeTeamId`.) *Verify:* teams load; selecting persists across reload; default = first team.

**Phase 3 — Cloud data layer.**
- `context/cloud.tsx` (projects/tasks/trials via `useQuery`, keyed by ids; TTLs as `staleTime`). Add `<CloudProvider>` under `<TeamProvider>`. *Verify:* `projects(activeTeamId)` returns list; switching team refetches.

**Phase 4 — Cloud projects UI (read-only).**
- `components/dialog-cloud-projects.tsx`: Team → Project → Task → Trial drilldown (list only).
- `pages/home.tsx` `HomeDesign`: add "Open Cloud Project" button (gated on `signedIn && activeTeam`) opening the dialog via `useDialog().show`. *Verify:* dialog renders the real hierarchy.

**Phase 5 — Open flow (the payoff).**
- `util/open-cloud.ts`: implement §5 steps 1–6 (probe/provision/poll/resolve-origin/pin/navigate), reusing `daytonaOpencodeOrigin`, `server.add`, `base64Encode`, `navigate`.
- Wire trial-row click in the dialog → `openCloud(descriptor)`. *Verify:* end-to-end against a real running trial; confirm session opens against the sandbox.

**Phase 6 — Persistence + recents + parity (incremental polish).**
- Persist `ActiveTrialDescriptor` (`Persist.global("activeTrial")`); surface cloud "recent worktrees" on home (mirrors launchpad recents, study:launchpad §3).
- Optional: trial/task creation (`trials.create`, `tasks.create`) + branch picker (`projects.branches`).
- Optional: route cloud opens through `orgn://open-sandbox` for one unified open path.

---

## 7. Open questions / risks / things to verify in code

1. **[BLOCKER] Desktop sandbox connectivity.** The supplied study:target-electron §4 is wrong that desktop can reuse `location.origin + "/__api"`. The `/__api` + `X-OpenCode-Target-URL` proxy is a **same-origin Cloudflare Worker** that (a) authorizes via the `oc.session` cookie and (b) mints the Daytona preview token server-side (`app-gate.ts:201-230`, `daytona.ts:46-81`). Electron has no such origin. **Verify which of these the Edge backend supports for desktop:**
   - (A) Does `GET /api/v1/trials/:id/sandbox/status` (or `preview-url`) return a *directly reachable, tokenized* `opencodeURL`? If yes → set `baseUrl = opencodeURL`, drop `target`/Worker entirely. Simplest.
   - (B) Does `${APP_URL}/__api` accept a **Bearer** (the id-orgn access token) in addition to the cookie? `app-gate.ts:203-210` only checks the cookie (`resolveSession`). If Bearer isn't accepted, desktop must first hit `${APP_URL}/api/auth/...` to obtain an `oc.session` cookie — and `platform.fetch`/Electron cookie handling for cross-origin must be confirmed.
   - This single answer determines step 4 of §5 and must be resolved before Phase 5.

2. **Edge auth header confirmation.** I assert Bearer-JWT (study:auth-idorgn §5.2). Verify the deno Edge actually accepts the id-orgn *access token* JWT (audience `o-xyz`) on `/api/v1/*`, not only `sk_` keys. If the JWT audience is wrong for Edge, a token-exchange or api-key path is needed.

3. **Two base URLs.** Confirm teams/credits are on `ID_URL/api/user/*` while projects/tasks/trials are on `API_URL/api/v1/*` (study:team-usermenu §2 vs study:edge-api §4). If both are actually under `API_URL`, simplify the client to one base.

4. **CORS / platform.fetch.** Cross-origin Edge calls from the webview will be CORS-blocked unless routed through `platform.fetch` (`server-sdk.tsx:29-33`). Confirm `platform.fetch` exists on the desktop preload and that the Edge sends permissive CORS or that platform.fetch bypasses it (it should, being main-process).

5. **Token refresh story.** Desktop currently keeps tokens in-memory only and never refreshes (auth.tsx). Long sessions will 401. Phase 0's `getAccessToken` refresh mitigates, but verify the id-orgn token endpoint issues refresh tokens for this public PKCE client (`offline_access` scope is requested — `id-orgn-auth.ts:17`).

6. **No SSH path.** vscode-cde uses `vscode-remote://cde-ssh+...`; opencode-v2 has only http/sidecar/ssh `ServerConnection` types and no SSH-remote-authority resolver wired for cloud. The port deliberately uses the **opencode-HTTP-in-sandbox** path instead. Confirm the sandbox actually runs an opencode HTTP server on `DAYTONA_OPENCODE_PORT` (4096) — it does for CDE Web (`launch.tsx`), but verify trials provisioned by the Edge expose the same.

7. **`workspacePath` correctness.** Default `/home/daytona/project` (study:trial-gate-open §1). Verify the Edge returns the real path (some projects nest the repo); `base64Encode(workspacePath)` must match the directory opencode serves, or the session route 404s.

8. **Team-switch while connected.** vscode-cde blocks team switching during an active trial (study:team-usermenu §3). Decide whether to replicate; at minimum, switching teams should not silently break a pinned sandbox server.

---

### Files to CREATE
- `packages/app/src/utils/edge-api-types.ts`
- `packages/app/src/utils/edge-api.ts`
- `packages/app/src/context/edge-api.tsx`
- `packages/app/src/context/team.tsx`
- `packages/app/src/context/cloud.tsx`
- `packages/app/src/components/dialog-cloud-projects.tsx`
- `packages/app/src/util/open-cloud.ts`

### Files to EXTEND
- `packages/app/src/utils/id-orgn-auth.ts` (add `refreshTokens`)
- `packages/app/src/context/auth.tsx` (expose `accessToken`/`getAccessToken`, store full token set) — currently `auth.tsx:60-68,81-88`
- `packages/app/src/app.tsx` (insert `EdgeAPIProvider`/`TeamProvider`/`CloudProvider` inside `AuthProvider`, around `GlobalProvider`) — `app.tsx:316-352`
- `packages/app/src/pages/home.tsx` (`HomeDesign` add "Open Cloud Project") — `home.tsx:122,339+`

### Existing primitives reused (no change)
- `daytonaOpencodeOrigin` / `DAYTONA_OPENCODE_PORT` — `packages/ui/src/brand/constants.ts:37-42`
- `ServerConnection.HttpBase.target` + key-with-target — `packages/app/src/context/server.tsx:150-161,197-203`
- `server.add()` — `packages/app/src/context/server.tsx:262-277`
- `X-OpenCode-Target-URL` injection — `packages/app/src/utils/server.ts:44-47`
- `/launch` pin+navigate ordering — `packages/app/src/pages/launch.tsx:38-46`
- `persisted()` / `Persist.global` — `packages/app/src/utils/persist.ts:470,524`
- `createSimpleContext` — every context (e.g. `global.tsx:12`)
- `useQuery` + app-wide `QueryProvider` — `home.tsx:164`, `app.tsx:86-97`
- `platform.fetch` for cross-origin http — `server-sdk.tsx:29-33`