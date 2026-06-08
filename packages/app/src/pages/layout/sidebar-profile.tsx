import { Show, createMemo } from "solid-js"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { useAuth } from "@/context/auth"
import { usePlatform } from "@/context/platform"

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
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
      class="shrink-0 border-t border-border-weak-base bg-background-base px-2 py-2"
    >
      <DropdownMenu placement="top-start" gutter={8}>
        <DropdownMenu.Trigger
          class="flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-raised-base-hover data-[expanded]:bg-surface-raised-base-active"
          aria-label={LABELS.settings}
        >
          <ProjectAvatar
            class="size-8 shrink-0"
            fallback={initials(label())}
            src={avatar()}
            variant="green"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-14-medium text-text-strong">{label()}</div>
            <Show when={subtitle()}>
              <div class="truncate text-12-regular text-text-weak">{subtitle()}</div>
            </Show>
          </div>
          <Icon name="chevron-down" class="size-3.5 shrink-0 text-icon-weak-base" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="mb-1 min-w-56">
            <Show when={signedIn() && subtitle()}>
              <div class="px-3 py-2 text-12-regular text-text-weak">{subtitle()}</div>
              <DropdownMenu.Separator />
            </Show>
            <DropdownMenu.Item onSelect={() => props.onSettings()}>
              <DropdownMenu.ItemLabel>{LABELS.settings}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={openUsage}>
              <DropdownMenu.ItemLabel>{LABELS.usage}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <Show when={signedIn()}>
              <DropdownMenu.Item onSelect={openProfile}>
                <DropdownMenu.ItemLabel>{LABELS.profile}</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            </Show>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => props.onConnectProvider()}>
              <DropdownMenu.ItemLabel>{LABELS.connect}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onSwitchServer()}>
              <DropdownMenu.ItemLabel>{LABELS.server}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onHelp()}>
              <DropdownMenu.ItemLabel>{LABELS.help}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <Show when={auth.enabled}>
              <DropdownMenu.Separator />
              <Show
                when={signedIn()}
                fallback={
                  <DropdownMenu.Item onSelect={() => void auth.signIn()}>
                    <DropdownMenu.ItemLabel>{LABELS.signIn}</DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                }
              >
                <DropdownMenu.Item onSelect={() => auth.signOut()}>
                  <DropdownMenu.ItemLabel>{LABELS.signOut}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              </Show>
            </Show>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}
