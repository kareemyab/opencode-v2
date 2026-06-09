/**
 * OLLM model catalog + provider-config builder. OLLM is the org's OpenAI-compatible
 * confidential-compute gateway. Models are fetched live from `${baseURL}/models` (team-keyed);
 * a static fallback guarantees the provider always has ≥1 model (opencode drops a provider
 * with zero models, so the fallback is an invariant, not a nicety).
 */

export interface OllmModel {
  id: string
  name?: string
}

/** Static fallback catalog (mirrors deno-stealth daytona.service.ts). */
export const OLLM_FALLBACK_MODELS: OllmModel[] = [
  { id: "near_gpt_oss_120b", name: "GPT-OSS 120B (NEAR TEE)" },
  { id: "near_deepseek_v3_1", name: "DeepSeek V3.1 (NEAR TEE)" },
  { id: "near_glm_4_7", name: "GLM 4.7 (NEAR TEE)" },
  { id: "near_qwen3_30b", name: "Qwen3 30B Instruct (NEAR TEE)" },
  { id: "phala_llama_3_3_70b", name: "Llama 3.3 70B Instruct (Phala TEE)" },
  { id: "phala_deepseek_chat_v3_1", name: "DeepSeek Chat V3.1 (Phala TEE)" },
  { id: "phala_deepseek_r1", name: "DeepSeek R1 (Phala TEE)" },
  { id: "phala_qwen3_30b", name: "Qwen3 30B Instruct (Phala TEE)" },
  { id: "phala_glm_4_6", name: "GLM 4.6 (Phala TEE)" },
]

/** opencode model record key: slashes/dots are not allowed in the config key segment. */
export function ollmModelKey(id: string): string {
  return id.replaceAll("/", "-").replaceAll(".", "-")
}

/** Reasoning capability (matches the deno catalog: only Llama-family is non-reasoning). */
export function isReasoningCapable(id: string): boolean {
  return !/llama/i.test(id)
}

type SimpleFetch = (req: {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
}) => Promise<{ ok: boolean; status: number; body: string }>

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Fetch the live OLLM model list (team-keyed). Retries transient failures before falling back
 * to the static catalog: at app boot the main-process fetch / network may not be ready yet, and
 * a boot-time fallback would otherwise persist a truncated 9-model list over the live ~217.
 */
export async function fetchOllmModels(baseURL: string, apiKey: string, fetchImpl?: SimpleFetch): Promise<OllmModel[]> {
  // allow_tee/allow_zdr MUST be boolean strings: empty values 400, `false` returns 0 models
  // (which would drop the provider). `true` returns the full confidential-compute catalog.
  const url = `${baseURL.replace(/\/+$/, "")}/models?allow_tee=true&allow_zdr=true`
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { ok, body } = fetchImpl
        ? await fetchImpl({ url, headers })
        : await fetch(url, { headers }).then(async (r) => ({ ok: r.ok, body: await r.text() }))
      if (!ok) throw new Error("models fetch failed")
      // The gateway returns the operator-curated label in `display_name` (an OpenAI-compatible
      // `/models` extension); there is no `name` field. Prefer `display_name`, fall back to `name`,
      // and trim/ignore blank values so a missing or whitespace-only label leaves `name` undefined
      // (callers then fall back to the id) instead of rendering an empty row in the picker.
      type RawModel = { id?: string; name?: string; display_name?: string }
      const json = JSON.parse(body) as { data?: RawModel[] } | RawModel[]
      const list = Array.isArray(json) ? json : (json.data ?? [])
      const models = list
        .filter((m): m is RawModel & { id: string } => !!m && typeof m.id === "string" && m.id.length > 0)
        .map((m) => ({ id: m.id, name: m.display_name?.trim() || m.name?.trim() || undefined }))
      if (models.length) return models
      throw new Error("empty model list")
    } catch {
      if (attempt < 2) await delay(800 * (attempt + 1))
    }
  }
  return OLLM_FALLBACK_MODELS
}

/** Build the opencode config.provider["ollm"] block. The apiKey is NOT included here — it is
 *  set separately via auth.set so it lands in auth.json, not config.json. */
export function buildOllmProviderConfig(input: { baseURL: string; models: OllmModel[]; teamId: string; name?: string }) {
  const models: Record<string, { name: string; tool_call: boolean; attachment: boolean; reasoning: boolean; limit: { context: number; output: number } }> = {}
  for (const m of input.models) {
    models[ollmModelKey(m.id)] = {
      name: m.name ?? m.id,
      tool_call: true,
      attachment: false,
      reasoning: isReasoningCapable(m.id),
      limit: { context: 128000, output: 8192 },
    }
  }
  return {
    npm: "@ai-sdk/openai-compatible",
    name: input.name ?? "OLLM (Confidential Compute)",
    options: {
      baseURL: input.baseURL,
      headers: { "x-team-id": input.teamId },
    },
    models,
  }
}

/** Pick a sensible default model key from a catalog (stable general-purpose first). */
export function pickDefaultModelKey(models: OllmModel[]): string | undefined {
  if (models.length === 0) return undefined
  const preferred = ["near_gpt_oss_120b", "phala_llama_3_3_70b", "phala_deepseek_chat_v3_1"]
  for (const id of preferred) {
    const match = models.find((m) => m.id === id)
    if (match) return ollmModelKey(match.id)
  }
  return ollmModelKey(models[0].id)
}
