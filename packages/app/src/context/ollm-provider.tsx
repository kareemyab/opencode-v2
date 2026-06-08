import { createSimpleContext } from "@opencode-ai/ui/context"
import { createEffect, createSignal, untrack } from "solid-js"
import { OLLM_GATEWAY_URL } from "@opencode-ai/ui/brand"
import { useAuth } from "./auth"
import { useTeam } from "./team"
import { useEdgeApi } from "./edge-api"
import { usePlatform } from "./platform"
import { useServerSDK } from "./server-sdk"
import { useServerSync } from "./server-sync"
import { buildOllmProviderConfig, fetchOllmModels, pickDefaultModelKey } from "@/utils/ollm-catalog"

const OLLM_PROVIDER_ID = "ollm"

/**
 * Configures OLLM (the org's confidential-compute OpenAI-compatible gateway) as a default
 * provider on the active opencode server, keyed by the active team's OLLM key. Mirrors the
 * vscode-cde "default-on" behavior: signed in + a team selected ⇒ OLLM is configured
 * automatically (no manual setup). Uses the same hot-apply path as the custom-provider dialog
 * (auth.set + global config.update → server rebuilds providers, no restart).
 */
export const { use: useOllm, provider: OllmProvider } = createSimpleContext({
  name: "Ollm",
  init: () => {
    const auth = useAuth()
    const team = useTeam()
    const edge = useEdgeApi()
    const platform = usePlatform()
    const serverSDK = useServerSDK()
    const serverSync = useServerSync()

    const [configuredTeam, setConfiguredTeam] = createSignal<string | undefined>()
    let applying: string | undefined

    const apply = async (teamId: string) => {
      if (applying === teamId) return
      applying = teamId
      try {
        const key = await edge.teams.ollmKey(teamId).catch(() => undefined)
        if (!key) return
        const baseURL = import.meta.env.VITE_OLLM_GATEWAY_URL ?? OLLM_GATEWAY_URL
        const models = await fetchOllmModels(baseURL, key, platform.apiFetch)

        // Order matters: write the key (auth.json) FIRST so the provider is "connected" by the
        // time config.model is validated against connected providers, then patch the config.
        await serverSDK.client.auth.set({ providerID: OLLM_PROVIDER_ID, auth: { type: "api", key } })

        const cfg = serverSync.data.config
        const patch: Record<string, unknown> = {
          provider: { [OLLM_PROVIDER_ID]: buildOllmProviderConfig({ baseURL, models, teamId }) },
        }
        const disabled = cfg.disabled_providers ?? []
        if (disabled.includes(OLLM_PROVIDER_ID)) {
          patch.disabled_providers = disabled.filter((id) => id !== OLLM_PROVIDER_ID)
        }
        // If an allowlist is set, OLLM must be in it or the provider is dropped.
        const enabled = cfg.enabled_providers
        if (Array.isArray(enabled) && !enabled.includes(OLLM_PROVIDER_ID)) {
          patch.enabled_providers = [...enabled, OLLM_PROVIDER_ID]
        }
        // Default to an OLLM model only if the user hasn't already chosen one.
        if (!cfg.model) {
          const def = pickDefaultModelKey(models)
          if (def) patch.model = `${OLLM_PROVIDER_ID}/${def}`
        }

        await serverSync.updateConfig(patch)
        setConfiguredTeam(teamId)
      } finally {
        applying = undefined
      }
    }

    createEffect(() => {
      const signedIn = auth.signedIn()
      const teamId = team.activeTeamId()
      const stamp = signedIn && teamId ? teamId : undefined
      if (!stamp) {
        setConfiguredTeam(undefined)
        return
      }
      if (untrack(configuredTeam) === stamp) return
      untrack(() => void apply(stamp))
    })

    return { configuredTeam }
  },
})
