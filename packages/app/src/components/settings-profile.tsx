import { Component, Show, createMemo, type JSX } from "solid-js"
import { Avatar } from "@opencode-ai/ui/v2/avatar-v2"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { ID_URL } from "@opencode-ai/ui/brand"
import { useAuth } from "@/context/auth"
import { useTeam } from "@/context/team"
import { usePlatform } from "@/context/platform"
import { SettingsList } from "./settings-list"

function displayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  const local = email.split("@")[0]?.trim()
  return local || "Guest"
}

function titleCase(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
}

/**
 * Account → Profile settings pane. Reads the signed-in id-orgn identity (decoded from the
 * id_token by the Auth context) plus the active team, and surfaces it read-only — id-orgn is
 * the source of truth, so edits happen on the hosted profile page (opened via the system
 * browser). Falls back to a sign-in prompt when the view-gate is enabled but signed out.
 */
export const SettingsProfile: Component = () => {
  const auth = useAuth()
  const team = useTeam()
  const platform = usePlatform()

  const user = createMemo(() => (auth.enabled ? auth.user() : null))
  const signedIn = createMemo(() => auth.enabled && auth.signedIn())
  const name = createMemo(() => {
    const current = user()
    return current ? displayName(current.name, current.email) : "Guest"
  })
  const email = createMemo(() => user()?.email ?? "")
  const avatar = createMemo(() => user()?.image ?? undefined)
  const activeTeam = createMemo(() => team.activeTeam())
  const profileUrl = `${ID_URL}/settings/profile`

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <h2 class="text-16-medium text-text-strong">Profile</h2>
        </div>
      </div>

      <Show
        when={signedIn()}
        fallback={
          <div class="flex flex-col items-start gap-4 rounded-lg bg-surface-base p-6">
            <div class="flex flex-col gap-1">
              <span class="text-14-medium text-text-strong">
                {auth.enabled ? "You're signed out" : "Profile unavailable"}
              </span>
              <span class="text-12-regular text-text-weak">
                {auth.enabled
                  ? "Sign in with your Orgn account to view your profile and usage."
                  : "Sign in is not enabled for this build."}
              </span>
            </div>
            <Show when={auth.enabled}>
              <Button size="small" variant="primary" onClick={() => void auth.signIn()}>
                <Icon name="enter" size="small" />
                Sign in
              </Button>
            </Show>
          </div>
        }
      >
        <div class="flex flex-col gap-8 w-full">
          {/* Identity card */}
          <div class="flex flex-wrap items-center gap-4 rounded-lg bg-surface-base p-5 sm:flex-nowrap">
            <Avatar class="size-16 shrink-0" kind="user" fallback={name()} src={avatar()} />
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="truncate text-16-medium text-text-strong">{name()}</span>
              <Show when={email()}>
                <span class="truncate text-13-regular text-text-weak">{email()}</span>
              </Show>
            </div>
            <Button
              size="small"
              variant="secondary"
              class="shrink-0"
              onClick={() => platform.openLink(profileUrl)}
            >
              Manage profile
              <Icon name="square-arrow-top-right" size="small" />
            </Button>
          </div>

          {/* Account details */}
          <div class="flex flex-col gap-1">
            <h3 class="text-14-medium text-text-strong pb-2">Account</h3>
            <SettingsList>
              <ProfileRow label="Full name" value={user()?.name?.trim() || "—"} />
              <ProfileRow label="Email" value={email() || "—"} />
              <ProfileRow label="Account ID" value={user()?.id ?? "—"} mono />
            </SettingsList>
          </div>

          {/* Team context */}
          <Show when={activeTeam()}>
            {(t) => (
              <div class="flex flex-col gap-1">
                <h3 class="text-14-medium text-text-strong pb-2">Team</h3>
                <SettingsList>
                  <ProfileRow
                    label="Active team"
                    value={t().displayName?.trim() || t().name}
                    icon={
                      <Avatar
                        class="size-5 shrink-0 rounded"
                        kind="org"
                        fallback={t().displayName?.trim() || t().name}
                        src={t().logo ?? undefined}
                      />
                    }
                  />
                  <ProfileRow label="Your role" value={titleCase(t().role) ?? "Member"} />
                  <ProfileRow
                    label="Teams"
                    value={String(team.teams().length)}
                  />
                </SettingsList>
              </div>
            )}
          </Show>

          {/* Session */}
          <div class="flex items-center justify-between gap-4 border-t border-border-weak-base pt-6">
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-14-medium text-text-strong">Log out</span>
              <span class="text-12-regular text-text-weak">Sign out of your Orgn account on this device.</span>
            </div>
            <Button size="small" variant="secondary" class="shrink-0" onClick={() => auth.signOut()}>
              <Icon name="enter" size="small" />
              Log out
            </Button>
          </div>
        </div>
      </Show>
    </div>
  )
}

const ProfileRow: Component<{ label: string; value: string; mono?: boolean; icon?: JSX.Element }> = (props) => {
  return (
    <div class="flex flex-wrap items-center gap-4 py-3 border-b border-border-weak-base last:border-none sm:flex-nowrap">
      <span class="min-w-0 flex-1 text-14-medium text-text-strong">{props.label}</span>
      <div class="flex min-w-0 items-center gap-2 sm:shrink-0 sm:justify-end">
        <Show when={props.icon}>{props.icon}</Show>
        <span
          classList={{
            "min-w-0 truncate text-text-weak": true,
            "text-12-mono": !!props.mono,
            "text-13-regular": !props.mono,
          }}
        >
          {props.value}
        </span>
      </div>
    </div>
  )
}
