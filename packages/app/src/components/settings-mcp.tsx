import type { Config, McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Select } from "@opencode-ai/ui/select"
import { Switch } from "@opencode-ai/ui/switch"
import { Tag } from "@opencode-ai/ui/tag"
import { TextField } from "@opencode-ai/ui/text-field"
import { createEffect, createMemo, For, Show, type Component } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"

type Translator = (key: string, vars?: Record<string, string | number | boolean>) => string

type McpEntry = {
  name: string
  type: "local" | "remote"
  details: string
  enabled: boolean
}

type ServerType = "remote" | "local"
type PairRow = { row: string; key: string; value: string }

let rowSeq = 0
const pairRow = (): PairRow => ({ row: `pair-${rowSeq++}`, key: "", value: "" })

function stringifyMcp(config: Config["mcp"] | undefined) {
  return JSON.stringify(config ?? {}, null, 2)
}

function parseEntries(mcp: Config["mcp"] | undefined): McpEntry[] {
  return Object.entries(mcp ?? {}).flatMap(([name, entry]) => {
    if (!entry || typeof entry !== "object" || !("type" in entry)) return []
    const typed = entry as McpLocalConfig | McpRemoteConfig
    return [
      {
        name,
        type: typed.type,
        details: typed.type === "local" ? typed.command.join(" ") : typed.url,
        enabled: typed.enabled !== false,
      },
    ]
  })
}

/**
 * Validate a parsed `mcp` object and return a single plain-language problem, or undefined when valid.
 * Mirrors the server-side schema (each entry is a discriminated union on `type`) but phrases the
 * failures in human terms so the user never sees raw schema jargon.
 */
function describeMcpProblem(mcp: unknown, t: Translator): string | undefined {
  if (!mcp || typeof mcp !== "object" || Array.isArray(mcp)) return t("settings.mcp.error.root")
  for (const [name, entry] of Object.entries(mcp as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return t("settings.mcp.error.entry.object", { name })
    const e = entry as Record<string, unknown>
    if (e.type !== "local" && e.type !== "remote") return t("settings.mcp.error.entry.type", { name })
    if (e.type === "remote" && (typeof e.url !== "string" || !e.url.trim()))
      return t("settings.mcp.error.entry.url", { name })
    if (
      e.type === "local" &&
      !(Array.isArray(e.command) && e.command.length > 0 && e.command.every((c) => typeof c === "string"))
    )
      return t("settings.mcp.error.entry.command", { name })
  }
  return undefined
}

export const SettingsMcp: Component = () => {
  const language = useLanguage()
  const platform = usePlatform()
  const server = useServer()
  const serverSync = useServerSync()

  const [store, setStore] = createStore({
    dirty: false,
    error: undefined as string | undefined,
    saving: false,
    text: stringifyMcp(serverSync.data.config.mcp),
    // tracks which MCP names have an in-flight toggle save
    toggling: {} as Record<string, boolean>,
  })

  const [form, setForm] = createStore({
    open: false,
    saving: false,
    name: "",
    type: "remote" as ServerType,
    url: "",
    command: "",
    pairs: [] as PairRow[],
    errors: {} as { name?: string; url?: string; command?: string },
    submitError: undefined as string | undefined,
  })

  const configDir = createMemo(() => serverSync.data.path.config)
  const entries = createMemo(() => parseEntries(serverSync.data.config.mcp))

  const typeOptions: { value: ServerType; label: string }[] = [
    { value: "remote", label: language.t("settings.mcp.form.type.remote") },
    { value: "local", label: language.t("settings.mcp.form.type.local") },
  ]

  createEffect(() => {
    const text = stringifyMcp(serverSync.data.config.mcp)
    if (store.dirty || store.text === text) return
    setStore("text", text)
  })

  const toggleEnabled = (name: string, currentEnabled: boolean) => {
    if (store.toggling[name]) return
    const currentMcp = serverSync.data.config.mcp ?? {}
    const entry = currentMcp[name]
    if (!entry) return

    const updated: Config["mcp"] = {
      ...currentMcp,
      [name]: { ...entry, enabled: !currentEnabled },
    }

    setStore("toggling", name, true)
    void serverSync
      .updateConfig({ mcp: updated })
      .catch((err: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => setStore("toggling", name, false))
  }

  const reset = () => {
    setStore({
      dirty: false,
      error: undefined,
      text: stringifyMcp(serverSync.data.config.mcp),
    })
  }

  const save = () => {
    if (store.saving) return

    let parsed: unknown
    try {
      parsed = JSON.parse(store.text.trim() || "{}")
    } catch {
      setStore("error", language.t("settings.mcp.error.json"))
      return
    }
    const problem = describeMcpProblem(parsed, language.t)
    if (problem) {
      setStore("error", problem)
      return
    }

    setStore("saving", true)
    setStore("error", undefined)

    void serverSync
      .updateConfig({ mcp: parsed as Config["mcp"] })
      .then(() => {
        setStore("dirty", false)
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("settings.mcp.toast.saved.title"),
          description: language.t("settings.mcp.toast.saved.description"),
        })
      })
      .catch((err: unknown) => {
        setStore("error", err instanceof Error ? err.message : String(err))
      })
      .finally(() => setStore("saving", false))
  }

  const format = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(store.text.trim() || "{}")
    } catch {
      setStore("error", language.t("settings.mcp.error.json"))
      return
    }
    setStore("text", JSON.stringify(parsed ?? {}, null, 2))
    setStore("error", undefined)
    setStore("dirty", true)
  }

  const openConfigFolder = () => {
    // The config path belongs to the active server; opening it in the local OS file explorer
    // only makes sense when that server is local. For a remote sandbox the path doesn't exist
    // on this machine, so the button is hidden and this is a defensive no-op.
    if (!platform.openPath || !configDir() || !server.isLocal()) return
    void platform.openPath(configDir())
  }

  const openForm = () => {
    setForm({
      open: true,
      name: "",
      type: "remote",
      url: "",
      command: "",
      pairs: [],
      errors: {},
      submitError: undefined,
    })
  }

  const closeForm = () => setForm("open", false)

  const addPair = () =>
    setForm(
      "pairs",
      produce((rows) => void rows.push(pairRow())),
    )
  const removePair = (index: number) =>
    setForm(
      "pairs",
      produce((rows) => void rows.splice(index, 1)),
    )
  const setPair = (index: number, field: "key" | "value", value: string) => setForm("pairs", index, field, value)

  const submitForm = () => {
    if (form.saving) return
    const existing = serverSync.data.config.mcp ?? {}
    const name = form.name.trim()
    const errors: { name?: string; url?: string; command?: string } = {}

    if (!name) errors.name = language.t("settings.mcp.form.error.name.required")
    else if (existing[name]) errors.name = language.t("settings.mcp.form.error.name.exists", { name })

    const pairs = Object.fromEntries(form.pairs.map((p) => [p.key.trim(), p.value.trim()]).filter(([k, v]) => k && v))

    let entry: McpLocalConfig | McpRemoteConfig | undefined
    if (form.type === "remote") {
      const url = form.url.trim()
      if (!url) errors.url = language.t("settings.mcp.form.error.url.required")
      else if (!/^https?:\/\//.test(url)) errors.url = language.t("settings.mcp.form.error.url.format")
      entry = { type: "remote", url, enabled: true, ...(Object.keys(pairs).length ? { headers: pairs } : {}) }
    } else {
      const command = form.command.trim().split(/\s+/).filter(Boolean)
      if (!command.length) errors.command = language.t("settings.mcp.form.error.command.required")
      entry = { type: "local", command, enabled: true, ...(Object.keys(pairs).length ? { environment: pairs } : {}) }
    }

    setForm("errors", errors)
    setForm("submitError", undefined)
    if (Object.keys(errors).length || !entry) return

    setForm("saving", true)
    void serverSync
      .updateConfig({ mcp: { ...existing, [name]: entry } })
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("settings.mcp.toast.added.title"),
          description: language.t("settings.mcp.toast.added.description", { name }),
        })
        closeForm()
      })
      .catch((err: unknown) => {
        setForm("submitError", err instanceof Error ? err.message : String(err))
      })
      .finally(() => setForm("saving", false))
  }

  const pairLabel = () =>
    form.type === "remote" ? language.t("settings.mcp.form.headers.label") : language.t("settings.mcp.form.env.label")
  const pairAddLabel = () =>
    form.type === "remote" ? language.t("settings.mcp.form.headers.add") : language.t("settings.mcp.form.env.add")

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8 max-w-[720px]">
          <h2 class="text-16-medium text-text-strong">{language.t("settings.mcp.title")}</h2>
          <p class="text-13-regular text-text-weak">{language.t("settings.mcp.description")}</p>
        </div>
      </div>

      <div class="flex flex-col gap-8 max-w-[720px]">
        {/* Configured servers */}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-baseline gap-3">
              <h3 class="text-14-medium text-text-strong">{language.t("settings.mcp.servers.title")}</h3>
              <Show when={store.dirty}>
                <span class="text-12-regular text-text-weak">{language.t("settings.mcp.servers.editingHint")}</span>
              </Show>
            </div>
            <Show when={!form.open}>
              <Button type="button" size="small" variant="secondary" icon="plus-small" onClick={openForm}>
                {language.t("settings.mcp.servers.add")}
              </Button>
            </Show>
          </div>

          {/* Add-server form */}
          <Show when={form.open}>
            <div class="flex flex-col gap-4 rounded-lg border border-border-weak-base bg-background-base p-4">
              <TextField
                label={language.t("settings.mcp.form.name.label")}
                placeholder={language.t("settings.mcp.form.name.placeholder")}
                value={form.name}
                onChange={(v) => {
                  setForm("name", v)
                  setForm("errors", "name", undefined)
                }}
                validationState={form.errors.name ? "invalid" : undefined}
                error={form.errors.name}
              />

              <div class="flex flex-col gap-1.5">
                <label class="text-12-medium text-text-weak">{language.t("settings.mcp.form.type.label")}</label>
                <Select
                  options={typeOptions}
                  current={typeOptions.find((o) => o.value === form.type)}
                  value={(o) => o.value}
                  label={(o) => o.label}
                  onSelect={(o) => o && setForm("type", o.value)}
                  variant="secondary"
                  size="small"
                  class="self-start"
                />
              </div>

              <Show when={form.type === "remote"}>
                <TextField
                  label={language.t("settings.mcp.form.url.label")}
                  placeholder={language.t("settings.mcp.form.url.placeholder")}
                  value={form.url}
                  onChange={(v) => {
                    setForm("url", v)
                    setForm("errors", "url", undefined)
                  }}
                  validationState={form.errors.url ? "invalid" : undefined}
                  error={form.errors.url}
                />
              </Show>

              <Show when={form.type === "local"}>
                <TextField
                  label={language.t("settings.mcp.form.command.label")}
                  placeholder={language.t("settings.mcp.form.command.placeholder")}
                  value={form.command}
                  onChange={(v) => {
                    setForm("command", v)
                    setForm("errors", "command", undefined)
                  }}
                  validationState={form.errors.command ? "invalid" : undefined}
                  error={form.errors.command}
                />
                <p class="text-12-regular text-text-weak -mt-2">{language.t("settings.mcp.form.command.help")}</p>
              </Show>

              {/* Optional headers (remote) / environment (local) */}
              <div class="flex flex-col gap-2">
                <label class="text-12-medium text-text-weak">{pairLabel()}</label>
                <For each={form.pairs}>
                  {(p, i) => (
                    <div class="flex gap-2 items-start" data-row={p.row}>
                      <div class="flex-1">
                        <TextField
                          label={language.t("settings.mcp.form.pair.key.label")}
                          hideLabel
                          placeholder={language.t("settings.mcp.form.pair.key.placeholder")}
                          value={p.key}
                          onChange={(v) => setPair(i(), "key", v)}
                        />
                      </div>
                      <div class="flex-1">
                        <TextField
                          label={language.t("settings.mcp.form.pair.value.label")}
                          hideLabel
                          placeholder={language.t("settings.mcp.form.pair.value.placeholder")}
                          value={p.value}
                          onChange={(v) => setPair(i(), "value", v)}
                        />
                      </div>
                      <IconButton
                        type="button"
                        icon="trash"
                        variant="ghost"
                        class="mt-1"
                        onClick={() => removePair(i())}
                        aria-label={language.t("settings.mcp.form.pair.remove")}
                      />
                    </div>
                  )}
                </For>
                <Button
                  type="button"
                  size="small"
                  variant="ghost"
                  icon="plus-small"
                  onClick={addPair}
                  class="self-start"
                >
                  {pairAddLabel()}
                </Button>
              </div>

              <Show when={form.submitError}>
                <p class="text-12-regular text-text-danger-base">{form.submitError}</p>
              </Show>

              <div class="flex items-center gap-2">
                <Button variant="primary" disabled={form.saving} onClick={submitForm}>
                  {form.saving ? language.t("settings.mcp.form.submitting") : language.t("settings.mcp.form.submit")}
                </Button>
                <Button variant="secondary" disabled={form.saving} onClick={closeForm}>
                  {language.t("common.cancel")}
                </Button>
              </div>
            </div>
          </Show>

          <Show
            when={entries().length > 0}
            fallback={
              <div class="flex items-center justify-center rounded-lg border border-border-weak-base bg-background-base h-16">
                <span class="text-13-regular text-text-weak">{language.t("settings.mcp.servers.empty")}</span>
              </div>
            }
          >
            <div class="rounded-lg border border-border-weak-base bg-background-base overflow-hidden">
              <For each={entries()}>
                {(entry) => (
                  <div class="flex items-center gap-3 px-4 py-3 border-b border-border-weak-base last:border-none">
                    <span class="text-14-medium text-text-strong shrink-0">{entry.name}</span>
                    <Tag>{entry.type}</Tag>
                    <span class="text-12-regular text-text-weak font-mono truncate flex-1 min-w-0">
                      {entry.details}
                    </span>
                    <Switch
                      checked={entry.enabled}
                      disabled={store.dirty || !!store.toggling[entry.name]}
                      onChange={() => toggleEnabled(entry.name, entry.enabled)}
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Advanced JSON editor */}
        <div class="flex flex-col gap-4">
          <h3 class="text-14-medium text-text-strong">{language.t("settings.mcp.editor.section")}</h3>

          {/* Config directory row */}
          <div class="flex items-center justify-between gap-4 min-h-10 rounded-md border border-border-weak-base bg-background-base px-3 py-2">
            <code class="text-12-regular text-text-weak break-all min-w-0">{configDir()}</code>
            <Show when={platform.openPath && configDir() && server.isLocal()}>
              <button
                type="button"
                title={language.t("settings.mcp.action.openConfigFolder")}
                aria-label={language.t("settings.mcp.action.openConfigFolder")}
                onClick={openConfigFolder}
                class="shrink-0 text-text-weak hover:text-text-base transition-colors"
              >
                <Icon name="folder" size="small" />
              </button>
            </Show>
          </div>

          {/* JSON textarea */}
          <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-4">
              <label class="text-13-medium text-text-base" for="settings-mcp-json">
                {language.t("settings.mcp.editor.label")}
              </label>
              <Show when={store.error}>
                <p class="text-12-regular text-text-danger-base text-right">{store.error}</p>
              </Show>
            </div>
            <p class="text-12-regular text-text-weak -mt-1">{language.t("settings.mcp.editor.help")}</p>
            <textarea
              id="settings-mcp-json"
              spellcheck={false}
              value={store.text}
              placeholder={language.t("settings.mcp.editor.placeholder")}
              onInput={(event) => {
                setStore("text", event.currentTarget.value)
                setStore("dirty", true)
                setStore("error", undefined)
              }}
              class="min-h-[200px] resize-y rounded-md border border-border-weak-base bg-background-base px-3 py-2.5 font-mono text-12-regular text-text-base outline-none focus:border-border-strong-base"
            />
          </div>

          {/* Actions */}
          <div class="flex items-center gap-2">
            <Button variant="primary" disabled={store.saving || !store.dirty} onClick={save}>
              {store.saving ? language.t("settings.mcp.action.saving") : language.t("common.save")}
            </Button>
            <Button variant="secondary" disabled={store.saving || !store.dirty} onClick={reset}>
              {language.t("common.reset")}
            </Button>
            <Button variant="ghost" disabled={store.saving} onClick={format}>
              {language.t("settings.mcp.action.format")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
