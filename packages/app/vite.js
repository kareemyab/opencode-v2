import { readFileSync } from "node:fs"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"

const theme = fileURLToPath(new URL("./public/oc-theme-preload.js", import.meta.url))

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

// SPA-public id-orgn config for the desktop PKCE view-gate (src/context/auth.tsx), baked into the
// renderer bundle as the VITE_-prefixed values it reads. These are non-secret public-client values
// (IdP base URL + public PKCE client id, with the opencode://auth-callback redirect) — NOT the web
// confidential client. Hardcoded defaults below; an env var (e.g. set in CI) overrides them per
// environment. `||` (not `??`) so an empty/unset env var falls back to the hardcoded default. The
// gate still only activates on the prod channel for platform === "desktop" — a no-op on web (gated
// by the Cloudflare app-gate Worker) and on dev/beta channels.
const idOrgnUrl = process.env.ID_ORGN_URL || "https://id.orgn.com"
const idOrgnDesktopClientId = process.env.ID_ORGN_DESKTOP_CLIENT_ID || "vU3lIIaieXkg4dzpd6GVee76CsDNHFRD"

/**
 * @type {import("vite").PluginOption}
 */
export default [
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: [
            {
              find: "@/components/terminal",
              replacement: fileURLToPath(new URL("./src/components/terminal.impl.tsx", import.meta.url)),
            },
            {
              find: "@",
              replacement: fileURLToPath(new URL("./src", import.meta.url)),
            },
          ],
        },
        define: {
          "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
          "import.meta.env.VITE_ID_ORGN_URL": JSON.stringify(idOrgnUrl),
          "import.meta.env.VITE_ID_ORGN_CLIENT_ID": JSON.stringify(idOrgnDesktopClientId),
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  {
    name: "opencode-desktop:theme-preload",
    transformIndexHtml(html) {
      return html.replace(
        '<script id="oc-theme-preload-script" src="/oc-theme-preload.js"></script>',
        `<script id="oc-theme-preload-script">${readFileSync(theme, "utf8")}</script>`,
      )
    },
  },
  tailwindcss(),
  solidPlugin(),
]
