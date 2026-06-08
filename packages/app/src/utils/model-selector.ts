export const VENDOR_ORDER = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "meta",
  "deepseek",
  "mistral",
  "qwen",
  "cohere",
  "moonshot",
  "perplexity",
  "microsoft",
  "amazon",
  "minimax",
  "nvidia",
  "ai21",
] as const

export const VENDOR_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  qwen: "Qwen",
  cohere: "Cohere",
  moonshot: "Moonshot",
  perplexity: "Perplexity",
  microsoft: "Microsoft",
  amazon: "Amazon",
  minimax: "MiniMax",
  nvidia: "NVIDIA",
  ai21: "AI21",
  other: "Other",
}

const PROVIDER_PATTERNS: ReadonlyArray<{ readonly id: string; readonly test: RegExp }> = [
  { id: "anthropic", test: /\bclaude\b/ },
  { id: "openai", test: /\bgpt\b|\bo[1345](?:\b|-)|\bcodex\b/ },
  { id: "google", test: /\bgemini\b|\bgemma\b/ },
  { id: "xai", test: /\bgrok\b/ },
  { id: "meta", test: /\bllama\b|\bmeta\b/ },
  { id: "deepseek", test: /\bdeepseek\b/ },
  { id: "mistral", test: /\b\w+(?:s|x)tral\b/ },
  { id: "qwen", test: /\bqwen|\btongyi\b/ },
  { id: "cohere", test: /\bcohere\b|\bcommand-r\b/ },
  { id: "moonshot", test: /\bkimi\b|\bmoonshot\b/ },
  { id: "microsoft", test: /\bphi-?\d/ },
  { id: "minimax", test: /\bminimax\b|\babab\b/ },
  { id: "perplexity", test: /\bperplexity\b|\bsonar\b/ },
  { id: "ai21", test: /\bjamba\b|\bai21\b/ },
  { id: "nvidia", test: /\bnvidia\b|\bnemotron\b/ },
  { id: "amazon", test: /\bnova[\s-]?(?:micro|lite|pro|premier|reel|canvas|sonic|\d)/ },
]

const INFRA_HOSTS = new Set(["phala", "near", "alibaba", "ollm", "opencode", "opencode-go", "vercel", "openrouter"])

const VENDOR_ICON: Record<string, string> = {
  meta: "llama",
  moonshot: "moonshotai",
  qwen: "alibaba",
  xai: "xai",
}

export type TeeFilter = "all" | "on" | "off"
export type CapabilityFilter = "all" | "multimodal" | "textOnly"

type ModelLike = {
  id: string
  name: string
  family?: string
  provider: { id: string; name: string }
  capabilities?: {
    reasoning?: boolean
    attachment?: boolean
    input?: {
      image?: boolean
      pdf?: boolean
    }
  }
}

export function modelKey(model: ModelLike) {
  return `${model.provider.id}:${model.id}`
}

export function vendorDisplayLabel(vendor: string) {
  return VENDOR_LABEL[vendor] ?? vendor.charAt(0).toUpperCase() + vendor.slice(1)
}

export function vendorIconId(vendor: string) {
  return VENDOR_ICON[vendor] ?? vendor
}

function stripTeePrefix(id: string) {
  const lower = id.toLowerCase()
  for (const prefix of ["near/", "phala/", "near-", "phala-"]) {
    if (lower.startsWith(prefix)) return id.slice(prefix.length)
  }
  return id
}

export function resolveVendor(model: ModelLike) {
  const haystack = [model.id, model.family, model.name, model.provider.id, model.provider.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/_/g, "-")

  for (const provider of PROVIDER_PATTERNS) {
    if (provider.test.test(haystack)) return provider.id
  }

  const stripped = stripTeePrefix(model.id)
  if (stripped.includes("/")) {
    const prefix = stripped.split("/")[0]?.toLowerCase()
    if (prefix && !INFRA_HOSTS.has(prefix)) return prefix
  }

  const provider = model.provider.id.toLowerCase()
  if (provider && !INFRA_HOSTS.has(provider)) return provider

  return "other"
}

export function isTeeModel(model: ModelLike) {
  const id = model.id.toLowerCase()
  const provider = model.provider.id.toLowerCase()
  return (
    id.startsWith("near/") ||
    id.startsWith("phala/") ||
    id.startsWith("near-") ||
    id.startsWith("phala-") ||
    provider === "near" ||
    provider === "phala"
  )
}

export function isMultimodalModel(model: ModelLike) {
  const input = model.capabilities?.input
  if (input) return Boolean(input.image || input.pdf)
  return model.capabilities?.attachment === true
}

export function orderVendors(vendors: Iterable<string>) {
  const set = new Set(vendors)
  const known = VENDOR_ORDER.filter((vendor) => set.has(vendor))
  const unknown = [...set]
    .filter((vendor) => !VENDOR_ORDER.includes(vendor as (typeof VENDOR_ORDER)[number]) && vendor !== "other")
    .sort((a, b) => a.localeCompare(b))
  return [...known, ...unknown, ...(set.has("other") ? ["other"] : [])]
}
