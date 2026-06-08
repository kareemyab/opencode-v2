import { fileURLToPath } from "node:url"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "electron-vite"
import appPlugin from "@opencode-ai/app/vite"
import * as fs from "node:fs/promises"

const appSrc = fileURLToPath(new URL("../app/src", import.meta.url))
const sidebarItems = fileURLToPath(new URL("../app/src/pages/layout/sidebar-items.tsx", import.meta.url))
const sidebarItemsPatched = fileURLToPath(new URL("../app/src/pages/layout/sidebar-items.patched.tsx", import.meta.url))

// Exact-match (anchored) so only the bare module specifier is redirected to its
// .patched variant. A plain string find prefix-matches in Vite's dev resolver and
// wrongly catches subpaths like `@/pages/layout/helpers`, rewriting them into
// `layout.patched.tsx/helpers` (a path inside a file) → "Failed to resolve import".
const patchedAliases = [
  { find: /^@\/pages\/layout$/, replacement: `${appSrc}/pages/layout.patched.tsx` },
  { find: /^@\/components\/titlebar$/, replacement: `${appSrc}/components/titlebar.patched.tsx` },
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
        alias: [...patchedAliases, ...rest, { find: "@", replacement: appSrc }],
      },
    }
  },
}

const OPENCODE_SERVER_DIST = "../opencode/dist/node"

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`

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
          assets: "./out/renderer/**",
          filesToDeleteAfterUpload: "./out/renderer/**/*.map",
        },
      })
    : false

export default defineConfig({
  main: {
    define: {
      "import.meta.env.OPENCODE_CHANNEL": JSON.stringify(channel),
    },
    build: {
      rollupOptions: {
        input: { index: "src/main/index.ts", sidecar: "src/main/sidecar.ts" },
      },
      externalizeDeps: { include: [nodePtyPkg] },
    },
    plugins: [
      {
        name: "opencode:node-pty-narrower",
        enforce: "pre",
        resolveId(s) {
          if (s === "@lydell/node-pty") return nodePtyPkg
        },
      },
      {
        name: "opencode:virtual-server-module",
        enforce: "pre",
        resolveId(id) {
          if (id === "virtual:opencode-server") return this.resolve(`${OPENCODE_SERVER_DIST}/node.js`)
        },
      },
      {
        name: "opencode:copy-server-assets",
        async writeBundle() {
          for (const l of await fs.readdir(OPENCODE_SERVER_DIST)) {
            if (!l.endsWith(".wasm")) continue
            await fs.writeFile(`./out/main/chunks/${l}`, await fs.readFile(`${OPENCODE_SERVER_DIST}/${l}`))
          }
        },
      },
    ],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    plugins: [appPlugin, patchedAliasOrder, sentry],
    resolve: {
      alias: patchedAliases,
    },
    publicDir: "../../../app/public",
    root: "src/renderer",
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          main: "src/renderer/index.html",
        },
      },
    },
  },
})
