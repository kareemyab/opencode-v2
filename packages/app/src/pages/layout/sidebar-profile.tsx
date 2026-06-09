import { Show, createMemo, createSignal, type JSX } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { Avatar } from "@opencode-ai/ui/v2/avatar-v2"
import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"
import { ServerConnection, useServer } from "@/context/server"
import { useTeam } from "@/context/team"

const LABELS = {
  settings: "Settings",
  usage: "Usage",
  profile: "Profile",
  connect: "Connect provider",
  server: "Switch server",
  help: "Get help",
  signOut: "Log out",
  signIn: "Sign in",
  guest: "Guest",
} as const

function displayName(name: string | null | undefined, email: string) {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  const local = email.split("@")[0]?.trim()
  return local || LABELS.guest
}

/**
 * Persistent Local ↔ Cloud switcher. Rendered in the shared sidebar footer, so it appears at the
 * bottom of both the local-project sidebar (Layout) and the cloud shell — giving symmetric,
 * always-visible switching between the two environments.
 *
 * Crucially, a cloud worktree opens as a *normal* session route (`/{dir}/session`) pinned to its
 * sandbox server — it is NOT under `/cloud`. So "which environment am I in?" is decided by the
 * active server (the open trial's sandbox = cloud), not the URL path. Switching re-activates the
 * right server (and resumes the live cloud session) instead of just navigating and losing it.
 */
function EnvironmentSwitcher(props: { onSwitch?: () => void }): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const server = useServer()
  const team = useTeam()

  const onCloudRoute = createMemo(() => location.pathname === "/cloud" || location.pathname.startsWith("/cloud/"))

  // A cloud worktree opens as a normal `/{dir}/session` route (pinned to the sandbox). Home (`/`)
  // and the cloud browser (`/cloud`) are NOT sessions — so a *lingering* sandbox connection on those
  // routes must not read as "in a cloud session". Without this guard, Home gets mislabeled "Cloud"
  // and the Cloud tab becomes a no-op (you can never reach the cloud browser from Home).
  const onSessionRoute = createMemo(() => /^\/[^/]+\/session(\/|$)/.test(location.pathname))

  // We're inside the cloud worktree session iff we're on a session route AND the active server is the
  // open trial's pinned sandbox (it renders in the same Layout as local sessions). `activeTrial` is
  // sticky, so it alone isn't "current" — it must match both the route and the active server.
  const inCloudSession = createMemo(() => {
    if (!onSessionRoute()) return false
    const trial = team.activeTrial()
    if (!trial) return false
    if (trial.serverKey) return server.key === trial.serverKey
    return !server.isLocal() // legacy descriptors (pre-serverKey): any remote server counts
  })

  const isCloud = createMemo(() => onCloudRoute() || inCloudSession())

  const localServerKey = (): ServerConnection.Key | undefined => {
    const conn =
      server.list.find((c) => ServerConnection.builtin(c)) ??
      server.list.find((c) => c.type === "http" && /\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(c.http.url))
    return conn ? ServerConnection.key(conn) : undefined
  }

  const goLocal = () => {
    // Leaving a cloud session whose descriptor predates `serverKey`? Stamp the current sandbox
    // server so "Cloud" can resume this exact session later (not just open the browser).
    const trial = team.activeTrial()
    if (trial && !trial.serverKey && inCloudSession()) {
      team.setActiveTrial({ ...trial, serverKey: server.key })
    }
    const key = localServerKey()
    if (key) server.setActive(key)
    navigate("/")
  }

  // The Cloud tab always opens the cloud shell (team switcher → projects → task list) — that's the
  // entry point into cloud. Resuming a specific worktree session is done from a task's worktrees
  // list, not from this tab. The trial/sandbox is never torn down, so nothing is lost.
  const goCloud = () => {
    navigate("/cloud")
  }

  return (
    <div class="flex items-center gap-1 rounded-lg bg-surface-raised-base p-1" role="tablist" aria-label="Environment">
      <EnvironmentSegment
        label="Local"
        icon="monitor"
        active={!isCloud()}
        onSelect={() => {
          if (isCloud()) goLocal()
          props.onSwitch?.()
        }}
      />
      <EnvironmentSegment
        label="Cloud"
        icon="cloud"
        active={isCloud()}
        onSelect={() => {
          if (!isCloud()) goCloud()
          props.onSwitch?.()
        }}
      />
    </div>
  )
}

function EnvironmentSegment(props: {
  label: string
  icon: IconProps["name"]
  active: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.active}
      onClick={() => props.onSelect()}
      classList={{
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-13-medium transition-colors focus-visible:outline-none": true,
        "bg-background-base text-text-strong shadow-xs-border-base": props.active,
        "text-text-weak hover:text-text-strong": !props.active,
      }}
    >
      <Icon name={props.icon} size="small" class="shrink-0" />
      {props.label}
    </button>
  )
}

function ProfileMenuItem(props: {
  icon: IconProps["name"]
  label: string
  onSelect: () => void
  danger?: boolean
}): JSX.Element {
  return (
    <DropdownMenu.Item
      onSelect={() => props.onSelect()}
      style={props.danger ? { color: "var(--icon-critical-base)" } : undefined}
    >
      <Icon
        name={props.icon}
        size="small"
        class={`shrink-0 ${props.danger ? "text-icon-critical-base" : "text-icon-weak-base"}`}
      />
      <DropdownMenu.ItemLabel>{props.label}</DropdownMenu.ItemLabel>
    </DropdownMenu.Item>
  )
}

export function SidebarProfileFooter(props: {
  onSettings: () => void
  onConnectProvider: () => void
  onSwitchServer: () => void
  onHelp: () => void
  onUsage?: () => void
}) {
  const auth = useAuth()
  const platform = usePlatform()
  const [menuOpen, setMenuOpen] = createSignal(false)

  const user = createMemo(() => (auth.enabled ? auth.user() : null))
  const signedIn = createMemo(() => auth.enabled && auth.signedIn())
  const label = createMemo(() => {
    const current = user()
    if (!current) return LABELS.guest
    return displayName(current.name, current.email)
  })
  const subtitle = createMemo(() => user()?.email ?? "")
  const avatar = createMemo(() => user()?.image ?? undefined)
  const profileUrl = createMemo(() => {
    const base = import.meta.env.VITE_ID_ORGN_URL ?? "https://id.orgn.com"
    return `${String(base).replace(/\/+$/, "")}/settings/profile`
  })

  const openProfile = () => {
    if (!signedIn()) return
    platform.openLink(profileUrl())
  }

  const openUsage = () => {
    if (props.onUsage) {
      props.onUsage()
      return
    }
    props.onSettings()
  }

  return (
    <div
      data-component="sidebar-profile"
      class="mt-auto shrink-0 border-t border-border-weak-base bg-background-base p-2"
    >
      <DropdownMenu open={menuOpen()} onOpenChange={setMenuOpen} placement="top-start" gutter={8}>
        <DropdownMenu.Trigger
          class="group flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-raised-base-hover data-[expanded]:bg-surface-raised-base-active"
          aria-label={label()}
        >
          <Avatar class="size-8 shrink-0" kind="user" fallback={label()} src={avatar()} />
          <div class="min-w-0 flex-1 leading-tight">
            <div class="truncate text-14-medium text-text-strong">{label()}</div>
            <Show when={subtitle()}>
              <div class="truncate text-12-regular text-text-weak">{subtitle()}</div>
            </Show>
          </div>
          <Icon
            name="selector"
            size="small"
            class="shrink-0 text-icon-weak-base transition-colors group-hover:text-icon-base"
          />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="mb-1 min-w-[256px]">
            {/* Environment switcher pinned to the top of the profile menu. */}
            <div class="px-1.5 pb-1 pt-0.5">
              <div class="px-1 pb-1 text-12-regular text-text-weak">Environment</div>
              <EnvironmentSwitcher onSwitch={() => setMenuOpen(false)} />
            </div>
            <DropdownMenu.Separator />
            <Show when={signedIn()}>
                <div class="flex items-center gap-2.5 px-2 py-2">
                  <Avatar class="size-9 shrink-0" kind="user" fallback={label()} src={avatar()} />
                  <div class="min-w-0 flex-1 leading-tight">
                    <div class="truncate text-14-medium text-text-strong">{label()}</div>
                    <Show when={subtitle()}>
                      <div class="truncate text-12-regular text-text-weak">{subtitle()}</div>
                    </Show>
                  </div>
                </div>
                <DropdownMenu.Separator />
              </Show>
              <ProfileMenuItem icon="settings-gear" label={LABELS.settings} onSelect={() => props.onSettings()} />
              <ProfileMenuItem icon="status" label={LABELS.usage} onSelect={openUsage} />
              <Show when={signedIn()}>
                <ProfileMenuItem icon="square-arrow-top-right" label={LABELS.profile} onSelect={openProfile} />
              </Show>
              <DropdownMenu.Separator />
              <ProfileMenuItem icon="plug" label={LABELS.connect} onSelect={() => props.onConnectProvider()} />
              <ProfileMenuItem icon="server" label={LABELS.server} onSelect={() => props.onSwitchServer()} />
              <ProfileMenuItem icon="help" label={LABELS.help} onSelect={() => props.onHelp()} />
              <Show when={auth.enabled}>
                <DropdownMenu.Separator />
                <Show
                  when={signedIn()}
                  fallback={<ProfileMenuItem icon="enter" label={LABELS.signIn} onSelect={() => void auth.signIn()} />}
                >
                  <ProfileMenuItem icon="enter" label={LABELS.signOut} danger onSelect={() => auth.signOut()} />
                </Show>
              </Show>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
    </div>
  )
}
