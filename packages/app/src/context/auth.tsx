import { createSimpleContext } from "@opencode-ai/ui/context"
import { makeEventListener } from "@solid-primitives/event-listener"
import { createSignal, onMount } from "solid-js"
import { usePlatform } from "./platform"
import { collectAuthCallbackDeepLinks, deepLinkEvent } from "@/pages/layout/deep-links"
import {
  buildAuthorizeUrl,
  exchangeCode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  userFromIdToken,
  type AuthUser,
  type DesktopAuthConfig,
} from "@/utils/id-orgn-auth"

/**
 * Desktop id-orgn view-gate state (in-memory only; never persisted).
 *
 * The auth-callback (orgn://auth-callback, or orgn-dev:// for an unpackaged dev build)
 * arrives BEFORE the user is signed in, while the gated app tree is unmounted — so this
 * provider, mounted above the gate, listens for the deep-link event directly and completes
 * the PKCE exchange. Web prod is gated by the Cloudflare Worker (enabled=false here);
 * dev/beta bypass.
 */
export const { use: useAuth, provider: AuthProvider } = createSimpleContext({
  name: "Auth",
  init: () => {
    const platform = usePlatform()
    const [user, setUser] = createSignal<AuthUser | null>(null)
    let pending: { state: string; codeVerifier: string } | undefined

    // Hardcoded prod defaults for the Orgn CDE desktop app (env override kept for
    // local/dev). The OAuth client is the id-orgn public PKCE client.
    const idOrgnUrl = import.meta.env.VITE_ID_ORGN_URL ?? "https://id.orgn.com"
    const clientId = import.meta.env.VITE_ID_ORGN_CLIENT_ID ?? "vU3lIIaieXkg4dzpd6GVee76CsDNHFRD"

    // Redirect scheme is resolved at runtime from the main process: orgn:// for a packaged
    // build, orgn-dev:// for an unpackaged `dev:desktop` run (so a local dev instance owns
    // its own callback without colliding with an installed Orgn CDE). Default to the prod
    // scheme until that resolves; web keeps it (the gate is disabled there).
    const [redirectUri, setRedirectUri] = createSignal("orgn://auth-callback")

    const config = (): DesktopAuthConfig => ({ idOrgnUrl, clientId, redirectUri: redirectUri() })

    const enabled =
      platform.platform === "desktop" &&
      import.meta.env.VITE_OPENCODE_CHANNEL === "prod" &&
      !!idOrgnUrl &&
      !!clientId

    const signIn = async () => {
      const state = generateState()
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      pending = { state, codeVerifier }
      platform.openLink(buildAuthorizeUrl(config(), { state, codeChallenge }))
    }

    const handleCallback = async (cb: { code: string; state: string }) => {
      if (!pending || pending.state !== cb.state) return
      const codeVerifier = pending.codeVerifier
      pending = undefined
      const tokens = await exchangeCode(config(), { code: cb.code, codeVerifier }).catch(() => null)
      if (!tokens) return
      const next = userFromIdToken(tokens.idToken)
      if (next) setUser(next)
    }

    onMount(() => {
      if (!enabled) return
      void platform.getAuthRedirectUri?.().then((uri) => {
        if (uri) setRedirectUri(uri)
      })
      makeEventListener(window, deepLinkEvent, (event) => {
        const detail = (event as CustomEvent<{ urls?: string[] }>).detail
        for (const cb of collectAuthCallbackDeepLinks(detail?.urls ?? [])) void handleCallback(cb)
      })
    })

    return {
      enabled,
      user,
      signedIn: () => !!user(),
      signIn,
      signOut: () => setUser(null),
    }
  },
})
