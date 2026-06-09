import { Component, Show, createMemo, For, Switch, Match } from "solid-js"
import { useQuery } from "@tanstack/solid-query"
import { Avatar } from "@opencode-ai/ui/v2/avatar-v2"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { ID_URL } from "@opencode-ai/ui/brand"
import { useAuth } from "@/context/auth"
import { useCloud } from "@/context/cloud"
import { useTeam } from "@/context/team"
import { usePlatform } from "@/context/platform"
import { SettingsList } from "./settings-list"
import type { Team } from "@/utils/edge-api-types"

const billingUrl = `${ID_URL}/settings/billing`

function teamLabel(team: Team | undefined): string {
  if (!team) return "Team"
  return team.displayName?.trim() || team.name || "Team"
}

function formatCredits(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function formatUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/**
 * Account → Usage settings pane. Shows the active team's credit balance prominently (id-orgn
 * billing ledger), flags a low/empty balance, and lists every team the user belongs to with
 * its own balance. Top-ups happen on the hosted billing page (opened in the system browser).
 */
export const SettingsUsage: Component = () => {
  const auth = useAuth()
  const cloud = useCloud()
  const team = useTeam()
  const platform = usePlatform()

  const signedIn = createMemo(() => auth.enabled && auth.signedIn())
  const activeId = createMemo(() => team.activeTeamId())
  const activeTeam = createMemo(() => team.activeTeam())
  const otherTeams = createMemo(() => team.teams().filter((t) => t.id !== activeId()))
  const credits = useQuery(() => cloud.teamCreditsQuery(activeId()))

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <h2 class="text-16-medium text-text-strong">Usage</h2>
        </div>
      </div>

      <Show
        when={signedIn() && activeTeam()}
        fallback={
          <div class="rounded-lg bg-surface-base p-6 text-12-regular text-text-weak">
            {auth.enabled ? "Sign in to view your team's credit usage." : "Usage is not available for this build."}
          </div>
        }
      >
        <div class="flex flex-col gap-8 w-full">
          {/* Active team balance */}
          <div class="flex flex-col gap-4 rounded-lg bg-surface-base p-5">
            <div class="flex items-center gap-2.5">
              <Avatar
                class="size-7 shrink-0 rounded"
                kind="org"
                fallback={teamLabel(activeTeam())}
                src={activeTeam()?.logo ?? undefined}
              />
              <div class="flex min-w-0 flex-col leading-tight">
                <span class="truncate text-14-medium text-text-strong">{teamLabel(activeTeam())}</span>
                <span class="text-12-regular text-text-weak">Available credits</span>
              </div>
            </div>

            <Switch>
              <Match when={credits.isLoading}>
                <span aria-hidden="true" class="h-9 w-40 animate-pulse rounded bg-surface-raised-base" />
              </Match>
              <Match when={credits.isError}>
                <span class="text-13-regular text-icon-critical-base">Couldn't load your balance.</span>
              </Match>
              <Match when={credits.data}>
                {(c) => {
                  const low = () =>
                    c().balance <= 0 ||
                    (typeof c().lowBalanceThreshold === "number" && c().balance <= c().lowBalanceThreshold!)
                  return (
                    <div class="flex flex-col gap-2">
                      <div class="flex items-end gap-2">
                        <span
                          classList={{
                            "text-32-mono tabular-nums leading-none": true,
                            "text-icon-critical-base": c().balance <= 0,
                            "text-text-strong": c().balance > 0,
                          }}
                        >
                          {formatCredits(c().balance)}
                        </span>
                        <span class="pb-0.5 text-12-regular text-text-weak">credits</span>
                      </div>
                      <Show when={low()}>
                        <span class="inline-flex items-center gap-1.5 text-12-medium text-icon-critical-base">
                          <Icon name="warning" size="small" />
                          {c().balance <= 0 ? "Your balance is empty." : "Your balance is running low."}
                        </span>
                      </Show>
                      <Show when={formatUpdated(c().updatedAt)}>
                        {(updated) => <span class="text-11-regular text-text-weak">Updated {updated()}</span>}
                      </Show>
                    </div>
                  )
                }}
              </Match>
            </Switch>

            <div>
              <Button size="small" variant="primary" onClick={() => platform.openLink(billingUrl)}>
                <Icon name="credit" size="small" />
                Manage billing
              </Button>
            </div>
          </div>

          {/* Per-team balances */}
          <Show when={otherTeams().length > 0}>
            <div class="flex flex-col gap-1">
              <h3 class="text-14-medium text-text-strong pb-2">Other teams</h3>
              <SettingsList>
                <For each={otherTeams()}>{(t) => <TeamCreditRow team={t} />}</For>
              </SettingsList>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

/** One row in the "Other teams" list — lazily fetches that team's balance via its own query. */
const TeamCreditRow: Component<{ team: Team }> = (props) => {
  const cloud = useCloud()
  const credits = useQuery(() => cloud.teamCreditsQuery(props.team.id))

  return (
    <div class="flex items-center gap-3 py-3 border-b border-border-weak-base last:border-none">
      <Avatar
        class="size-6 shrink-0 rounded"
        kind="org"
        fallback={teamLabel(props.team)}
        src={props.team.logo ?? undefined}
      />
      <span class="min-w-0 flex-1 truncate text-14-medium text-text-strong">{teamLabel(props.team)}</span>
      <Switch>
        <Match when={credits.isLoading}>
          <span aria-hidden="true" class="h-3 w-16 animate-pulse rounded bg-surface-raised-base" />
        </Match>
        <Match when={credits.isError}>
          <span class="text-12-regular text-text-weak">—</span>
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
              {formatCredits(c().balance)} credits
            </span>
          )}
        </Match>
      </Switch>
    </div>
  )
}
