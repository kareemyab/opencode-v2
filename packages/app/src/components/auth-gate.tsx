import { Show, type ParentProps } from "solid-js"
import { useAuth } from "@/context/auth"

/**
 * Blocks the app tree until the desktop id-orgn view-gate is satisfied. No-op (renders
 * children) unless the gate is enabled (desktop + prod + id-orgn configured).
 */
export function AuthGate(props: ParentProps) {
  const auth = useAuth()
  return (
    <Show when={!auth.enabled || auth.signedIn()} fallback={<SignInScreen onSignIn={() => void auth.signIn()} />}>
      {props.children}
    </Show>
  )
}

function SignInScreen(props: { onSignIn: () => void }) {
  return (
    <div class="h-dvh w-screen flex flex-col items-center justify-center bg-background-base gap-6 p-6">
      <div class="flex flex-col items-center max-w-md text-center gap-1">
        <p class="text-14-regular text-text-strong font-medium">Sign in to opencode</p>
        <p class="text-12-regular text-text-weak">Sign in with id-orgn to continue.</p>
      </div>
      <button
        type="button"
        onClick={props.onSignIn}
        class="px-4 py-2 rounded-md bg-surface-base hover:bg-surface-raised-base-hover text-14-regular text-text-strong transition-colors"
      >
        Sign in with id-orgn
      </button>
    </div>
  )
}
