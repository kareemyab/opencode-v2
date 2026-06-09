Fully confirmed. `id-orgn.getTeams` → `fetchTeams(config, …)` → `${config.url}/api/user/teams`, where `config.url` is the id-orgn base (same URL that builds the OAuth `authorizationEndpoint`). The CDE bridge comment at line 980-982 explicitly confirms: "The base URL comes from `product.cde.apiUrl` and the access token is the same id-orgn JWT the user already has from sign-in." This is the authoritative confirmation of Claim A and the base-URL asymmetry.

I now have complete, evidence-backed answers. Here is the verification section.

---

# Verification & Corrections

I re-read the actual source (vscode-cde extension host + workbench contribs, the deno-api.md, the app-gate Worker, and the opencode-v2 app/desktop renderer). The blueprint's three load-bearing claims are **substantially correct**, with a few precision fixes and one outright wrong assumption about the Electron transport. Evidence below is `file:line` from the real tree.

## A) Edge API authentication — CONFIRMED (Bearer id-orgn access token, no separate Edge api-key)

The blueprint is correct: first-party calls use the **id-orgn access token as a Bearer JWT** plus `X-Selected-Team-ID`. There is no separately-minted Edge api-key in the editor path. The `sk_…` / `X-API-Key` path is for external/MCP integrations only.

Authoritative evidence (the real HTTP/auth lives in the `id-orgn-authentication` *extension host*, not in `cdeProjectsView.ts` — the view only dispatches `cde.*`/`id-orgn.*` commands):

- Teams/credits hit the **id-orgn base** (`config.url`), Bearer access token, `Accept: application/json`, NO team header:
  - `extensions/id-orgn-authentication/src/extension.ts:1979-1981` — `fetch(\`${config.url}/api/user/teams\`, { headers: { Authorization: \`Bearer ${token}\`, Accept: 'application/json' } })`
  - `:2011-2013` — `${config.url}/api/user/teams/${teamId}/credits`, same header shape.
- Projects/tasks/trials hit the **Edge base** (`apiUrl` = `product.cde.apiUrl`), Bearer access token + `X-Selected-Team-ID`:
  - `:2317-2323` (`fetchProjects`): `Authorization: Bearer ${token}`, `Accept`, `X-Selected-Team-ID: teamId`, against `${apiUrl}/api/v1/projects?teamId=&archived=false&deleted=false`.
  - `cdeTeamHeaders()` at `:1637-1641` is literally `{ 'X-Selected-Team-ID': id }`.
- The same token is reused; the code comment is explicit at `:980-982`: *"The base URL comes from `product.cde.apiUrl` and the access token is the same id-orgn JWT the user already has from sign-in."*
- `config.url` is the id-orgn base — it's the very URL used to build the OAuth endpoints (`idOrgnServer.ts:179-182`). So the **base-URL asymmetry the blueprint flags is real**: `id-orgn.url/api/user/*` (teams/credits) vs `cde.apiUrl/api/v1/*` (projects/tasks/trials).
- 401 → reactive `forceRefresh()` + single replay: `:2328-2344` (projects), `:1984-1995` (teams). Matches the blueprint.
- Retry on 408/425/429/500/502/503/504 via `fetchCdeWithRetry`/`shouldRetryCdeResponse`: `:1869-1903`. Matches.
- Envelope unwrap `{ success, data } | bare`: `unwrapCdeApiEnvelope` at `:341-358`; projects tolerate bare-array (`:2363`). Matches.

deno-api.md §2 corroborates three modes: **JWT Bearer (first-party), session cookie (browser fallback), api-key `sk_` (external/MCP)** — and notes "A JWT-shaped token is rejected by `apiKeyAuth` (and vice versa)" (`deno-api.md:31-33,51`). So a desktop port using the JWT path is correct; do NOT mint an `sk_` key.

**Minor correction to the blueprint's §1.3 wording:** it says switching team "fires storage-change listeners → balance + project list re-fetch." That's right but conflated across two files — see Claim C; the *balance* refetch is in the user menu, the *project list* refetch is in the projects view-model. The blueprint's data-model interfaces (CdeProject/Task/Trial) match `cdeProjectsState.ts:21-133` field-for-field — accurate.

## B) Open-cloud-project mechanism — CONFIRMED, with exact sequence

The blueprint's open sequence is accurate. Precise, verified flow:

1. Trigger: clicking a trial row calls `gateService.activate(descriptor)` — `cdeProjectsView.ts:601-619` (`activateTrialFromTree` builds the `ActiveTrialDescriptor` and calls `this.gateService.activate(descriptor)`).
2. `activate()` (`cdeTrialGate.contribution.ts:420-564`):
   - Phase 0 fast path: `cde.probeTrialSandbox` → if `ready`, persist + `_attachWindow` (`:452-469`).
   - Phase 1 provision (unless `skipClientSandboxProvision`): `cde.provisionTrialSandbox` (`:482-496`).
   - Phase 2 poll status running: `_poll(... s === 'running' || 'active' || 'started', { attempts: 60, intervalMs: 2000 })` → ~2 min (`:503-509`).
   - Phase 3 poll OpenCode reachable: `_poll(p => p.ready, { attempts: 30, intervalMs: 2000 })` → ~60 s (`:514-520`).
   - Phase 4 `_attachWindow` (`:566-664`): `cde.getTrialFullDetails` → `workspacePath` (default **`/home/daytona/project`**, `:576-578`), `cde.recordActiveTrialForResolver` (`:587-594`), SSH probe with retry (`:619`), `cde.prewarmRemoteServer` (`:652`).
3. **openFolder URI/authority — exact format** (`:654-663`):
   ```ts
   const remoteUri = URI.from({
     scheme: 'vscode-remote',
     authority: `cde-ssh+${encodeURIComponent(descriptor.trialId)}`,
     path: folderPath,            // workspacePath, leading-slash-normalized
   })
   await this.commandService.executeCommand('vscode.openFolder', remoteUri, { forceReuseWindow: true })
   ```
   So the authority is `cde-ssh+<encodeURIComponent(trialId)>` and the URI is `vscode-remote://cde-ssh+<trialId>/<workspacePath>`, `{forceReuseWindow:true}`. Exactly as the blueprint stated.

**Critical detail the blueprint under-weighted (important for the port):** readiness is determined by `probeTrialSandbox` (`extension.ts:3472-3515`), which (1) `GET ${apiUrl}/api/v1/trials/:id/sandbox/status` and then (2) **`fetch(opencodeURL)` directly from the Node extension host** with a 6s timeout, accepting **any status < 500** as "alive" (`:3499`). The comment at `:3469` says the renderer can't do step 2 "because of CORS — the extension host does it." This is the load-bearing transport fact the blueprint's §7 BLOCKER needs (see the Electron correction below). The `sandbox/status` endpoint and `provision`/`start`/`preview-url` endpoints all exist (deno-api.md §7.11: `:435-440`).

## C) Team-switch persistence + downstream refetch — CONFIRMED, richer than stated

- **Storage key:** `idOrgn.selectedTeamId`, `StorageScope.APPLICATION`, `StorageTarget.USER`.
  - Defined `idOrgnUserMenu.ts:37`; also re-exported as `SELECTED_TEAM_STORAGE_KEY` in `cdeProjectsState.ts:308`.
  - Write on switch: `idOrgnUserMenu.ts:1107` — `storageService.store(SELECTED_TEAM_STORAGE_KEY, sel.teamId, StorageScope.APPLICATION, StorageTarget.USER)` (inside the `Switch Team` quick-pick `onDidAccept`, `:1104-1110`). Also `setSelectedTeam` at `:424-426`.
  - Default = `teams[0]` when persisted id absent/stale: `:413-420`.
- **What re-runs on switch (two independent listeners on the same key):**
  1. User-menu pill (`idOrgnUserMenu.ts:267-299`): `onSelectedTeamChanged()` → re-render balance + `fetchBalance(... force:false)`. So **balance/credits refetch** lives here.
  2. Projects view-model (`cdeProjectsViewModel.ts:116-130`): wipes `_nodes`, `_teamMembers`, clears `SELECTED_PROJECT_STORAGE_KEY`, fires `onDidChange({scope:'all'})`, then `refreshProjects()` + `refreshTeamMembers()`. So **project list + members refetch** lives here.

**Correction/addition the blueprint missed:** team switching is **blocked while a remote sandbox is active**. `idOrgnUserMenu.ts:1029-1033` aborts `switchTeam` with a notification if `ACTIVE_TRIAL_STORAGE_KEY` (`cde.activeTrial`) is set; the "Switch team…" row is also disabled in a remote session (`:790-799`). The blueprint mentions this only as an open question (§7.8 "decide whether to replicate") — it is in fact already enforced upstream and the storage key it keys on is `cde.activeTrial` (`cdeProjectsState.ts:358`).

---

## Things the blueprint got WRONG or imprecise about the TARGET (opencode-v2)

These are the consequential ones — they change Phase 1/4/5 of the plan.

1. **WRONG: "platform.fetch bypasses CORS because it's main-process." It does not.** In the Electron renderer, `platform.fetch` is literally the renderer's own window `fetch`:
   `packages/desktop/src/renderer/index.tsx:252-255` —
   ```ts
   fetch: (input, init) => {
     if (input instanceof Request) return fetch(input)
     return fetch(input, init)
   }
   ```
   It is NOT `net.fetch`/main-process and does NOT escape web-context CORS. The blueprint's §2(b), §4, and §7.4 all lean on "must use platform.fetch (main-process, bypasses CORS)" — that premise is false here. Cross-origin Edge calls (`api.orgn.com`, `id.orgn.com`) will be subject to normal CORS and depend on `CORS_ORIGINS` allowing the Electron origin (deno-api.md §4: `:155-161` — CORS is an env allowlist with `credentials:true`; the app origin must be listed). For a port, the realistic options are: (a) ensure the Electron app origin is in `CORS_ORIGINS`, or (b) route Edge calls through the main process over IPC (a real main-process fetch), or (c) loosen webSecurity for those hosts. None of these is "just use platform.fetch."

2. **IMPRECISE: `platform.fetch` is selected only for non-loopback HTTP, never HTTPS.** `server-sdk.tsx:28-37` returns `platform.fetch` only when `url.protocol === "http:" && !loopback` (`:33`). For HTTPS (which the Edge API and Daytona previews are), it returns `undefined` → default fetch. So citing `server-sdk.tsx:29-33` as the precedent for "cross-origin HTTPS must use platform.fetch" is backwards.

3. **IMPRECISE: QueryProvider is not simply "app-wide."** There are TWO: an outer one in `AppBaseProviders` (`app.tsx:176`) and an inner one **inside `ServerKey`** (`app.tsx:330`). `home.tsx`'s `useQuery` (`home.tsx:164`) renders inside the router → `ServerKey` → inner QueryProvider, so it binds to a **server-scoped** QueryClient that is recreated on server-key change. A team switch is NOT a server-key change, so "team switch invalidates queries cleanly" does not happen for free — the cloud context must invalidate by query key itself (which the blueprint does key by teamId, so it's recoverable, but the rationale was wrong).

4. **MISSED: the provider stack already has `AuthProvider` + an `AuthGate`.** Real order (`app.tsx:316-352`): `AuthProvider > ServerProvider > GlobalProvider > AuthGate > ConnectionGate > Router > TabsProvider > ServerKey > QueryProvider > ServerSDKProvider > ServerSyncProvider`. The blueprint says insert new providers "inside AuthProvider, around GlobalProvider" and never mentions `AuthGate` (`components/auth-gate.tsx`), which already blocks the tree behind `auth.signedIn()` when `auth.enabled`. New cloud/team/edge providers should go under `GlobalProvider` (so `useGlobal`/server are available) but the team/cloud data fetches must be gated on `auth.signedIn()` exactly like `AuthGate` already does — and note `AuthGate` is a no-op on web/dev (`auth.enabled` false), so on the web build there's no signed-in user from this gate at all.

5. **CONFIRMED but worth stating precisely: auth.tsx really does drop the tokens.** `handleCallback` (`auth.tsx:60-68`) calls `exchangeCode` then only `userFromIdToken(tokens.idToken)`; `accessToken`/`refreshToken`/`expiresIn` from `DesktopTokenSet` (`id-orgn-auth.ts:59-64,90-95`) are discarded. There is NO `refreshTokens` helper today and NO proactive/reactive refresh. The scope already includes `offline_access` (`id-orgn-auth.ts:17`) so a refresh token should be issued — but `exchangeCode` is a public PKCE client with `client_id` in the body and no secret (`:66-77`); the port's new `refreshTokens` must use the same public-client form (`grant_type=refresh_token`, `client_id` in body, no secret).

6. **CONFIRMED: the §7 BLOCKER is real and correctly diagnosed.** The `/__api` proxy authorizes ONLY via the `oc.session` cookie — `app-gate.ts:201-210` (`resolveSession` reads `OC_SESSION` cookie at `:95-99`; 401 if absent at `:205-207`). There is **no Bearer path** at the proxy. The Daytona preview token is minted server-side with an admin key and never exposed to the browser — `daytona.ts:46-66` (`getPreviewToken`) + `:71-81` (`daytonaAuthHeaders`). So in Electron, where `location.origin` is `app://`/dev-server (no same-origin Worker), `baseUrl = location.origin + "/__api"` will 404, and the renderer cannot mint the preview token. The blueprint's two options (A: Edge returns a ready-to-use tokenized `opencodeURL`; B: route through `${APP_URL}/__api` with an `oc.session` cookie) are the correct framing.
   - Important nuance the blueprint missed: `daytonaAuthHeaders` **falls back to public-preview** (just `X-Daytona-Skip-Preview-Warning` + `X-Daytona-Disable-CORS`, no token) when `DAYTONA_API_URL`/`DAYTONA_API_KEY` are unset (`daytona.ts:75-80`). And vscode-cde's extension host reaches `opencodeURL` with a *plain* `fetch` and treats any `<500` as alive (`extension.ts:3494-3499`). That strongly implies the Daytona preview can be reachable with only the skip-warning header in some configs — so Option A (direct `opencodeURL`, no Worker, no `target`) is more plausible than the blueprint's pessimism suggests, but it still requires the Daytona preview to be PUBLIC (or the token to be embedded in the returned URL). This must be verified against a live trial before committing to Phase 5.

7. **CONFIRMED accurately:** `daytonaOpencodeOrigin` / `DAYTONA_OPENCODE_PORT=4096` (`packages/ui/src/brand/constants.ts:37-42` — actually the function is at the bottom; constants `ID_URL`/`API_URL`/`APP_URL` at the top, all matching the cited values), `ServerConnection.target` (`server.tsx:160`) + key-with-target (`:197-203`), `server.add` sets active (`:262-277`, active at `:274`), `X-OpenCode-Target-URL` injection (`server.ts:44-47`), `/launch` pin+navigate ordering (`launch.tsx:38-46`), `Persist.global` (`persist.ts:470`) + `persisted` (`:524`), `useDialog` (`home.tsx:126`), deep-link `open-sandbox` parsing (`deep-links.ts:21,121-133`). The line numbers are close enough to be load-bearing-correct.

## Completeness check — what a working port still needs (beyond the blueprint)

- **Sandbox readiness polling is non-trivial and the renderer can't do the HTTP probe.** Upstream does a TWO-stage probe: status endpoint + a direct `fetch(opencodeURL)` from Node (CORS-exempt) accepting `<500` (`extension.ts:3472-3515`). In Electron the renderer fetch is CORS-bound (correction #1), so the port needs either a main-process probe over IPC or to rely solely on `sandbox/status` (which only tells you Daytona's view, not that OpenCode HTTP is answering). The blueprint's "poll sandboxStatus until running" is necessary but **not sufficient** — it omits the OpenCode-HTTP-liveness gate that upstream considers essential.
- **SSE for live updates is entirely absent from the blueprint.** deno-api.md §6 / §7.31 expose `GET /api/v1/events/{tasks,projects,teams,all}` and `tasks/:id/agent-stream`, all JWT. The blueprint's TTL-based `useQuery` polling will feel stale vs. upstream. Not a blocker for v1, but name it.
- **Token refresh for long sessions is real and unbuilt.** No refresh today (correction #5). Edge returns 401 → the client must `getToken(force=true)` once and replay (upstream pattern). The port's `getAccessToken` must implement proactive (expiry-buffer) + reactive (on 401) refresh, against the public PKCE token endpoint.
- **Error/empty states.** Upstream tracks `_projectError`, ignores stale-team responses (`cdeProjectsViewModel.ts:120,356,417,425`), shows reauth prompts on 401, and surfaces specific provision errors (zero credits `INSUFFICIENT_CREDITS` 402, `github-token` → "Connect GitHub", orphaned-runner → "Re-provision sandbox"; `cdeTrialGate.contribution.ts:546-554,558-560`). The blueprint's UI section says "list only" and doesn't budget for these.
- **Team-switch-while-connected is already enforced upstream** (correction in C) — the port should replicate the `cde.activeTrial`-keyed block, not leave it as an "open question."
- **`workspacePath` correctness** — upstream defaults `/home/daytona/project` but prefers `details.workspacePath` from `getTrialFullDetails` (`:576-578`). The blueprint hardcodes the default in §5 step 3; it should fetch the real path first (the merged trial+history endpoint), or `base64Encode(workspacePath)` may mismatch the served directory.
- **CORS allowlist for the Electron origin** (correction #1) — must be confirmed in `CORS_ORIGINS` or the whole Edge data layer fails before any of the above matters.

## Bottom line

The three load-bearing claims (A Bearer-JWT auth + base-URL asymmetry; B probe→provision→poll→SSH→openFolder `vscode-remote://cde-ssh+<trialId>/<path>`; C `idOrgn.selectedTeamId` APPLICATION/USER with balance-refetch in the user menu and project/member-refetch in the view-model) are **CONFIRMED with evidence**. The blueprint is safe to build on for the data layer and the open-flow shape. The one thing it gets materially wrong is the **Electron transport**: `platform.fetch` is the renderer's own CORS-bound fetch, not a main-process bypass — which makes both the Edge cross-origin calls and the `/__api` desktop-sandbox connectivity harder than the blueprint implies, and is the real risk to retire before Phase 1/Phase 5.