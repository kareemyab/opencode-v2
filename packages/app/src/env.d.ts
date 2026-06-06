interface ImportMetaEnv {
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
  readonly VITE_OPENCODE_CHANNEL?: "dev" | "beta" | "prod"
  // Set at build time for the hosted, id-orgn-gated deploy (served behind the Cloudflare
  // app-gate Worker). When set, the SPA talks to the same-origin "/__api" proxy instead of
  // a direct opencode server. Unset for the embedded prod binary and dev.
  readonly VITE_OPENCODE_GATEWAY?: string
  // SPA-public id-orgn config for the desktop PKCE view-gate (no secret).
  readonly VITE_ID_ORGN_URL?: string
  readonly VITE_ID_ORGN_CLIENT_ID?: string

  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
