import { $ } from "bun"

const channel = process.env.OPENCODE_CHANNEL ?? "dev"

await $`bun ./scripts/copy-icons.ts ${channel}`

// Rebrand the unpackaged Electron.app (name + native icon) so the local app
// presents as the branded desktop app rather than "Electron" (macOS only; no-op elsewhere).
await $`bun ./scripts/patch-dev-electron.ts ${channel}`

await $`cd ../opencode && bun script/build-node.ts`
