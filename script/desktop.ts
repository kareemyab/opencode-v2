#!/usr/bin/env bun
// Starts the Electron desktop app in the PROD channel by default, so its UI
// matches production (no DEV badge, prod layout) — same as `bun local`.
// Override with OPENCODE_CHANNEL=dev for the dev channel.
//
//   bun script/desktop.ts                 # prod channel
//   OPENCODE_CHANNEL=dev bun script/desktop.ts
//
// Note: in unpackaged dev the OS-level app name stays "OpenCode Dev" (set in
// the main process); the channel here controls the rendered UI, not that label.

process.env.OPENCODE_CHANNEL ??= "prod"

const child = Bun.spawn(["bun", "--cwd", "packages/desktop", "dev"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "inherit", "inherit"],
})

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill())
process.exit((await child.exited) ?? 0)
