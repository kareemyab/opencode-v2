import { For, Show, type Accessor } from "solid-js"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Icon } from "@opencode-ai/ui/icon"
import { TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { ProjectAvatar } from "@opencode-ai/ui/v2/project-avatar-v2"
import { getProjectAvatarVariant, type LocalProject } from "@/context/layout"
import { displayName, getProjectAvatarSource } from "@/pages/layout/helpers"

/**
 * Design-system shell-nav cells (the top strip).
 *
 * The strip mirrors the Orgn CDE shell frame: a fixed-width toggle cell on the
 * left, a PROJECT / WORKSPACE breadcrumb + switcher in the lead, and a fixed
 * "menu" cell on the right. Cells are `w-12` (48px) with shell hairline borders,
 * matching the design system's side-strip geometry.
 */

const SIDE_CELL =
  "flex h-full w-12 shrink-0 items-center justify-center [app-region:no-drag]"

export function ShellSidebarToggle(props: { onToggle: () => void; label: string; keybind: string }) {
  return (
    <div class={`${SIDE_CELL} border-r border-border-weak-base`}>
      <TooltipKeybind placement="bottom" title={props.label} keybind={props.keybind}>
        <IconButton icon="sidebar" variant="ghost" onClick={() => props.onToggle()} aria-label={props.label} />
      </TooltipKeybind>
    </div>
  )
}

export function ShellBreadcrumb(props: {
  project: Accessor<LocalProject | undefined>
  workspace: Accessor<string | undefined>
  projects: Accessor<LocalProject[]>
  activeWorktree: Accessor<string | undefined>
  onSelectProject: (project: LocalProject) => void
  onOpenProject: () => void
  openProjectLabel: string
  emptyLabel: string
  label: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        aria-label={props.label}
        class="group/breadcrumb flex h-full min-w-0 max-w-[42%] shrink items-center gap-2 px-2 [app-region:no-drag] hover:bg-surface-base-hover data-[expanded]:bg-surface-base-active"
      >
        <Show
          when={props.project()}
          fallback={
            <span class="text-[11px] font-medium uppercase tracking-[0.18em] text-text-weak">{props.emptyLabel}</span>
          }
        >
          {(project) => (
            <>
              <ProjectAvatar
                class="shrink-0"
                fallback={displayName(project())}
                src={getProjectAvatarSource(project().id, project().icon)}
                variant={getProjectAvatarVariant(project().icon?.color)}
              />
              <div class="flex min-w-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em]">
                <span class="shrink-0 truncate text-text-base">{displayName(project())}</span>
                <Show when={props.workspace()}>
                  <span class="shrink-0 text-text-weaker">/</span>
                  <span class="min-w-0 truncate text-text-weak">{props.workspace()}</span>
                </Show>
              </div>
            </>
          )}
        </Show>
        <Icon name="chevron-down" class="size-3.5 shrink-0 text-icon-weak-base" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="mt-1 min-w-56">
          <For each={props.projects()}>
            {(project) => (
              <DropdownMenu.Item
                class="flex items-center gap-2"
                onSelect={() => props.onSelectProject(project)}
                data-active={props.activeWorktree() === project.worktree ? "" : undefined}
              >
                <ProjectAvatar
                  class="shrink-0"
                  fallback={displayName(project)}
                  src={getProjectAvatarSource(project.id, project.icon)}
                  variant={getProjectAvatarVariant(project.icon?.color)}
                />
                <DropdownMenu.ItemLabel class="truncate">{displayName(project)}</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            )}
          </For>
          <Show when={props.projects().length > 0}>
            <DropdownMenu.Separator />
          </Show>
          <DropdownMenu.Item onSelect={() => props.onOpenProject()}>
            <DropdownMenu.ItemLabel>{props.openProjectLabel}</DropdownMenu.ItemLabel>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

export function ShellUserMenu(props: {
  onSettings: () => void
  onConnectProvider: () => void
  onSwitchServer: () => void
  onHelp: () => void
  menuLabel: string
  settingsLabel: string
  connectLabel: string
  serverLabel: string
  helpLabel: string
}) {
  return (
    <div class={`${SIDE_CELL} border-l border-border-weak-base`}>
      <DropdownMenu>
        <DropdownMenu.Trigger as={IconButton} icon="settings-gear" variant="ghost" aria-label={props.menuLabel} />
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="mt-1 min-w-48">
            <DropdownMenu.Item onSelect={() => props.onSettings()}>
              <DropdownMenu.ItemLabel>{props.settingsLabel}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onConnectProvider()}>
              <DropdownMenu.ItemLabel>{props.connectLabel}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => props.onSwitchServer()}>
              <DropdownMenu.ItemLabel>{props.serverLabel}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => props.onHelp()}>
              <DropdownMenu.ItemLabel>{props.helpLabel}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  )
}
