import { domain } from "./stage"

const GITHUB_APP_ID = new sst.Secret("GITHUB_APP_ID")
const GITHUB_APP_PRIVATE_KEY = new sst.Secret("GITHUB_APP_PRIVATE_KEY")
export const EMAILOCTOPUS_API_KEY = new sst.Secret("EMAILOCTOPUS_API_KEY")
const ADMIN_SECRET = new sst.Secret("ADMIN_SECRET")
const DISCORD_SUPPORT_BOT_TOKEN = new sst.Secret("DISCORD_SUPPORT_BOT_TOKEN")
const DISCORD_SUPPORT_CHANNEL_ID = new sst.Secret("DISCORD_SUPPORT_CHANNEL_ID")
const FEISHU_APP_ID = new sst.Secret("FEISHU_APP_ID")
const FEISHU_APP_SECRET = new sst.Secret("FEISHU_APP_SECRET")
const bucket = new sst.cloudflare.Bucket("Bucket")

export const api = new sst.cloudflare.Worker("Api", {
  domain: `api.${domain}`,
  handler: "packages/function/src/api.ts",
  environment: {
    WEB_DOMAIN: domain,
  },
  url: true,
  link: [
    bucket,
    GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY,
    ADMIN_SECRET,
    DISCORD_SUPPORT_BOT_TOKEN,
    DISCORD_SUPPORT_CHANNEL_ID,
    FEISHU_APP_ID,
    FEISHU_APP_SECRET,
  ],
  transform: {
    worker: (args) => {
      args.logpush = true
      if ($app.stage === "vimtor" || $app.stage === "adam") return
      args.bindings = $resolve(args.bindings).apply((bindings) => [
        ...bindings,
        {
          name: "SYNC_SERVER",
          type: "durable_object_namespace",
          className: "SyncServer",
        },
      ])
      args.migrations = {
        // Note: when releasing the next tag, make sure all stages use tag v2
        oldTag: $app.stage === "production" || $app.stage === "thdxr" ? "" : "v1",
        newTag: $app.stage === "production" || $app.stage === "thdxr" ? "" : "v1",
        //newSqliteClasses: ["SyncServer"],
      }
    },
  },
})

new sst.cloudflare.x.Astro("Web", {
  domain: "docs." + domain,
  path: "packages/web",
  environment: {
    // For astro config
    SST_STAGE: $app.stage,
    VITE_API_URL: api.url.apply((url) => url!),
  },
})

// The web app is fronted by a Cloudflare Worker (packages/function/src/app-gate.ts) that
// gates the SPA shell behind id-orgn and same-origin-proxies the data plane to a
// network-isolated opencode backend. The SPA itself is served via the Workers static-assets
// binding. NOTE: `packages/app/dist` must be built (`bun turbo build`) before deploy.
const SESSION_SECRET = new sst.Secret("SESSION_SECRET")
const ID_ORGN_CLIENT_SECRET = new sst.Secret("ID_ORGN_CLIENT_SECRET")

new sst.cloudflare.Worker("WebApp", {
  domain: "app." + domain,
  handler: "packages/function/src/app-gate.ts",
  environment: {
    APP_URL: "https://app." + domain,
    ID_ORGN_URL: process.env.ID_ORGN_URL ?? "",
    ID_ORGN_CLIENT_ID: process.env.ID_ORGN_CLIENT_ID ?? "",
    ID_ORGN_CLIENT_SECRET: ID_ORGN_CLIENT_SECRET.value,
    SESSION_SECRET: SESSION_SECRET.value,
    OPENCODE_CHANNEL: process.env.OPENCODE_CHANNEL ?? "prod",
    OPENCODE_BACKEND_URL: process.env.OPENCODE_BACKEND_URL ?? "",
  },
  transform: {
    worker: (args) => {
      args.logpush = true
      // Workers static-assets binding -> the built SPA. SST 4.13.1 has no first-class
      // assets field, so inject the raw Cloudflare assets config here. The Worker runs first
      // for the auth + proxy prefixes and gates everything else before serving an asset.
      // VERIFY these field names against the installed @pulumi/cloudflare version at deploy
      // time (camelCase Pulumi vs snake_case CF API) — this is the one deploy-validated bit.
      ;(args as any).assets = {
        directory: "packages/app/dist",
        binding: "ASSETS",
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/auth/*", "/__api/*", "/*"],
      }
    },
  },
})
