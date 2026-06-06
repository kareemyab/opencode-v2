import { Tooltip } from "@opencode-ai/ui/tooltip"

const TDX_SANDBOX_HOVER =
  "Confidential Sandbox with Intel TDX Encrypted CPU and Memory"

export function TdxSandboxBadge(props: { class?: string }) {
  return (
    <Tooltip placement="top" value={TDX_SANDBOX_HOVER} class="flex h-full items-stretch">
      <span
        classList={{
          "flex h-full shrink-0 cursor-default items-center gap-1 border border-brand-green/40 bg-brand-green-bg px-1.5 text-brand-green text-[9px]": true,
          [props.class ?? ""]: !!props.class,
        }}
      >
        <svg
          class="h-3 w-3 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 5.5L8 2L14 5.5V10.5L8 14L2 10.5V5.5Z"
            stroke="currentColor"
            stroke-linecap="square"
          />
          <path d="M8 8V14M2 5.5L8 8L14 5.5" stroke="currentColor" stroke-linecap="square" />
        </svg>
        <span class="font-medium">TDX Sandbox</span>
      </span>
    </Tooltip>
  )
}
