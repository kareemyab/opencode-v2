import { createSimpleContext } from "@opencode-ai/ui/context"
import { createEffect, createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { useAuth } from "./auth"
import { useEdgeApi } from "./edge-api"
import { Persist, persisted } from "@/utils/persist"
import type { ActiveTrialDescriptor, Team } from "@/utils/edge-api-types"

/**
 * Active id-orgn team. Persisted (Persist.global "selectedTeamId"), defaults to the first
 * team, and — mirroring vscode-cde — switching is blocked while a cloud worktree (trial) is
 * open. Also owns the persisted `activeTrial` descriptor so both the team gate and the
 * open-cloud flow share one source of truth.
 */
export const { use: useTeam, provider: TeamProvider } = createSimpleContext({
  name: "Team",
  init: () => {
    const auth = useAuth()
    const edge = useEdgeApi()

    const [selected, setSelected, , selectedReady] = persisted(
      Persist.global("selectedTeamId"),
      createStore<{ id: string | null }>({ id: null }),
    )
    const [activeTrialStore, setActiveTrialStore] = persisted(
      Persist.global("activeTrial"),
      createStore<{ value: ActiveTrialDescriptor | null }>({ value: null }),
    )

    const [teamsRes] = createResource(
      () => (auth.signedIn() ? "load" : null),
      () => edge.teams.list().catch(() => [] as Team[]),
    )
    const teams = createMemo<Team[]>(() => teamsRes() ?? [])

    const activeTeamId = createMemo<string | undefined>(() => {
      const list = teams()
      if (list.length === 0) return undefined
      const pinned = selected.id ? list.find((t) => t.id === selected.id) : undefined
      return pinned?.id ?? list[0]?.id
    })
    const activeTeam = createMemo(() => teams().find((t) => t.id === activeTeamId()))

    // Make the first-team fallback sticky once persistence has hydrated, so the active team
    // is deterministic across reloads/refetches (and not silently re-keyed by team order).
    createEffect(() => {
      if (!selectedReady()) return
      const list = teams()
      if (list.length === 0) return
      if (selected.id && list.some((t) => t.id === selected.id)) return
      if (!activeTrialStore.value) setSelected("id", list[0].id)
    })

    return {
      teams,
      activeTeamId,
      activeTeam,
      loading: () => teamsRes.loading,
      /** Switch the active team. Returns false (no-op) while a cloud worktree is active. */
      setActiveTeam: (id: string): boolean => {
        if (activeTrialStore.value) return false
        setSelected("id", id)
        return true
      },
      /** Persisted descriptor of the currently-open cloud worktree (or null). */
      activeTrial: () => activeTrialStore.value,
      setActiveTrial: (descriptor: ActiveTrialDescriptor | null) => setActiveTrialStore("value", descriptor),
    }
  },
})
