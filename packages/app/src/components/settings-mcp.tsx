import type { Config, McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { Tag } from "@opencode-ai/ui/tag"
import { createEffect, createMemo, For, Show, type Component } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"

type McpEntry = {
  name: string
  type: "local" | "remote"
  details: string
  enabled: boolean
}

function stringifyMcp(config: Config["mcp"] | undefined) {
  return JSON.stringify(config ?? {}, null, 2)
}

function parseMcpConfig(text: string): Config["mcp"] {
  const parsed: unknown = JSON.parse(text.trim() || "{}")
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("MCP config must be a JSON object")
  }
  return parsed as Config["mcp"]
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

  const configDir = createMemo(() => serverSync.data.path.config)
  const entries = createMemo(() => parseEntries(serverSync.data.config.mcp))

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

    let mcp: Config["mcp"]
    try {
      mcp = parseMcpConfig(store.text)
    } catch (err) {
      setStore("error", err instanceof Error ? err.message : String(err))
      return
    }

    setStore("saving", true)
    setStore("error", undefined)

    void serverSync
      .updateConfig({ mcp })
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

  const openConfigFolder = () => {
    // The config path belongs to the active server; opening it in the local OS file explorer
    // only makes sense when that server is local. For a remote sandbox the path doesn't exist
    // on this machine, so the button is hidden and this is a defensive no-op.
    if (!platform.openPath || !configDir() || !server.isLocal()) return
    void platform.openPath(configDir())
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8 max-w-[720px]">
          <h2 class="text-16-medium text-text-strong">{language.t("settings.mcp.title")}</h2>
          <p class="text-13-regular text-text-weak">{language.t("settings.mcp.description")}</p>
        </div>
      </div>

      <div class="flex flex-col gap-8 max-w-[720px]">

        {/* Configured servers table */}
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline gap-3">
            <h3 class="text-14-medium text-text-strong">{language.t("settings.mcp.servers.title")}</h3>
            <Show when={store.dirty}>
              <span class="text-12-regular text-text-weak">{language.t("settings.mcp.servers.editingHint")}</span>
            </Show>
          </div>
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

        {/* Editor section */}
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
          </div>
        </div>

      </div>
    </div>
  )
}
