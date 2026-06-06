#!/usr/bin/env bun
// Run a local replica of PRODUCTION, end-to-end.
//
// Builds the single opencode binary with the web UI embedded (channel=prod),
// then serves the UI **and** the API together on ONE origin — exactly how the
// released app / opencode.ai delivers it. Open the printed URL and that single
// page IS the prod app (no proxy, no separate UI server, no DEV badge).
//
//   bun script/prod-local.ts                # build if needed, then serve on :4096
//   bun script/prod-local.ts --port 5000    # serve on a different port
//   bun script/prod-local.ts --rebuild      # force a fresh build (after code changes)
//
// This serves a BUILT artifact, so there is NO hot reload. Re-run with --rebuild
// to pick up source changes. To live-edit the UI instead, use `bun dev:stack`.

import { parseArgs } from "node:util"
import { existsSync } from "node:fs"

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4096" },
    hostname: { type: "string", default: "127.0.0.1" },
    rebuild: { type: "boolean", default: false },
  },
})

const platform = process.platform === "win32" ? "windows" : process.platform
const bin = `packages/opencode/dist/opencode-${platform}-${process.arch}/bin/opencode${process.platform === "win32" ? ".exe" : ""}`

if (values.rebuild || !existsSync(bin)) {
  console.log(values.rebuild ? "Rebuilding prod binary (channel=prod)…" : "No prod binary found — building (channel=prod)…")
  const build = Bun.spawn(["bun", "./packages/opencode/script/build.ts", "--single", "--skip-install"], {
    cwd: process.cwd(),
    env: { ...process.env, OPENCODE_CHANNEL: "prod" },
    stdio: ["inherit", "inherit", "inherit"],
  })
  const code = await build.exited
  if (code !== 0) {
    console.error(`Build failed (exit ${code}).`)
    process.exit(code ?? 1)
  }
}

console.log(`\nProd replica → http://localhost:${values.port}  (UI + API on one origin, channel=prod)`)
console.log(`Stop with Ctrl-C. Code changed? re-run with --rebuild.\n`)

const server = Bun.spawn([bin, "serve", "--port", values.port, "--hostname", values.hostname], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "inherit", "inherit"],
})
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => server.kill())
process.exit((await server.exited) ?? 0)
