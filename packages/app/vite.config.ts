import { fileURLToPath } from "node:url"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "vite"
import desktopPlugin from "./vite"

const src = fileURLToPath(new URL("./src", import.meta.url))
const sidebarItems = fileURLToPath(new URL("./src/pages/layout/sidebar-items.tsx", import.meta.url))
const sidebarItemsPatched = fileURLToPath(new URL("./src/pages/layout/sidebar-items.patched.tsx", import.meta.url))

// Exact-match (anchored) so only the bare module specifier is redirected to its
// .patched variant. A plain string find prefix-matches in Vite's dev resolver and
// wrongly catches subpaths like `@/pages/layout/helpers`, rewriting them into
// `layout.patched.tsx/helpers` (a path inside a file) → "Failed to resolve import".
const patchedAliases = [
  { find: /^@\/pages\/layout$/, replacement: `${src}/pages/layout.patched.tsx` },
  { find: /^@\/components\/titlebar$/, replacement: `${src}/components/titlebar.patched.tsx` },
  { find: sidebarItems, replacement: sidebarItemsPatched },
]

const patchedAliasOrder = {
  name: "opencode:patched-alias-order",
  config(config) {
    const existing = config.resolve?.alias
    const list = Array.isArray(existing)
      ? [...existing]
      : existing
        ? Object.entries(existing).map(([find, replacement]) => ({ find, replacement }))
        : []

    const rest = list.filter((entry) => {
      const find = String(entry.find)
      return find !== "@" && find !== "@/pages/layout" && find !== "@/components/titlebar" && entry.replacement !== sidebarItemsPatched
    })

    return {
      resolve: {
        alias: [...patchedAliases, ...rest, { find: "@", replacement: src }],
      },
    }
  },
}

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      })
    : false

export default defineConfig({
  plugins: [desktopPlugin, patchedAliasOrder, sentry] as any,
  resolve: {
    alias: patchedAliases,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
