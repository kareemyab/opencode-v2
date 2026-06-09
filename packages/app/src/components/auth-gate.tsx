import { createSignal, Show, type ParentProps } from "solid-js"
import { useAuth } from "@/context/auth"
import { CornerBrackets } from "@/components/corner-brackets"
import { OrgnLogoLottie } from "@/components/orgn-logo-lottie"
import { TextScramble } from "@/components/text-scramble"

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
  const [isSigningIn, setIsSigningIn] = createSignal(false)
  const [isUnlockHovered, setIsUnlockHovered] = createSignal(false)

  const handleSignIn = () => {
    if (isSigningIn()) return
    setIsSigningIn(true)
    props.onSignIn()
  }

  return (
    <div class="grid h-dvh w-screen grid-cols-1 bg-black font-sans select-none lg:grid-cols-2">
      <div class="relative hidden items-center justify-center px-12 lg:flex">
        <OrgnLogoLottie large />
      </div>

      <main class="flex flex-col items-center justify-center px-6 py-12">
        <div class="flex w-full max-w-[360px] flex-col items-center gap-8">
          <OrgnLogoLottie class="lg:hidden" />

          <div class="flex w-full flex-col items-center gap-3 text-center">
            <h1 class="font-[var(--font-family-mono)] text-[22px] font-medium uppercase tracking-[0.38em] text-white/65 leading-none">
              Welcome back
            </h1>
            <p class="text-14-regular text-white/50">Sign in with id-orgn to continue to Orgn CDE.</p>
          </div>

          <div class="relative w-full max-w-[280px]">
            <CornerBrackets class="z-10" color="bg-white" />
            <button
              type="button"
              onClick={handleSignIn}
              onMouseEnter={() => setIsUnlockHovered(true)}
              onMouseLeave={() => setIsUnlockHovered(false)}
              onFocus={() => setIsUnlockHovered(true)}
              onBlur={() => setIsUnlockHovered(false)}
              disabled={isSigningIn()}
              class="relative inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-dashed bg-transparent px-4 py-2 text-sm font-medium uppercase tracking-[0.15em] text-white outline-none transition-all disabled:pointer-events-none"
              classList={{
                "cursor-not-allowed border-white/50 opacity-80": isSigningIn(),
                "cursor-pointer border-white/30 hover:border-white/60 hover:bg-white/5": !isSigningIn(),
              }}
            >
              <Show when={isSigningIn()}>
                <span
                  class="absolute inset-0 animate-[shimmer_1.5s_ease-in-out_infinite]"
                  style={{
                    "background-image": "linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)",
                  }}
                />
              </Show>
              <Show
                when={isSigningIn()}
                fallback={
                  <TextScramble
                    as="span"
                    class="pointer-events-none inline-flex select-none items-center justify-center font-mono text-[21px] font-black leading-none [font-synthesis:weight] [font-weight:900]"
                    trigger={isUnlockHovered()}
                    duration={0.6}
                    speed={0.03}
                    characterSet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                  >
                    UNLOCK
                  </TextScramble>
                }
              >
                <span class="pointer-events-none inline-flex select-none items-center justify-center gap-2 font-mono text-[15px] uppercase tracking-[0.15em]">
                  <svg
                    class="h-4 w-4 animate-[spin_1s_linear_infinite]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Redirecting
                </span>
              </Show>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
