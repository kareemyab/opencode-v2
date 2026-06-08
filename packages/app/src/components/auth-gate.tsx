import { Show, type ParentProps } from "solid-js"
import { WordmarkV2 } from "@opencode-ai/ui/v2/wordmark-v2"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
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
    <div class="grid h-dvh w-screen grid-cols-1 bg-black font-sans select-none lg:grid-cols-2">
      <div class="relative hidden items-center justify-center px-12 lg:flex">
        <OrgnAlphaLockup large />
      </div>

      <main class="flex flex-col items-center justify-center px-6 py-12">
        <div class="flex w-full max-w-[360px] flex-col items-center gap-8">
          <OrgnAlphaLockup class="lg:hidden" />

          <div class="flex w-full flex-col items-center gap-3 text-center">
            <h1 class="font-[var(--font-family-mono)] text-[22px] font-medium uppercase tracking-[0.38em] text-white/65 leading-none">
              Welcome back
            </h1>
            <p class="text-14-regular text-white/50">Sign in with id-orgn to continue to Orgn CDE.</p>
          </div>

          <ButtonV2 variant="neutral" size="large" onClick={props.onSignIn}>
            Sign in with id-orgn
          </ButtonV2>
        </div>
      </main>
    </div>
  )
}

function OrgnAlphaLockup(props: { class?: string; large?: boolean }) {
  return (
    <div class={`flex items-center gap-2 ${props.class ?? ""}`}>
      <WordmarkV2 class={`${props.large ? "h-10" : "h-[22px]"} w-auto shrink-0 text-white`} />
      <span class="rounded bg-white px-1.5 py-[3px] text-[11px] leading-none font-[var(--font-family-mono)] [font-weight:600] tracking-[0.08em] text-black">
        ALPHA
      </span>
    </div>
  )
}
