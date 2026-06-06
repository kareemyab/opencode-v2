#!/usr/bin/env bun
// Solid one-command local dev, in the PROD channel.
//
// It ALWAYS frees the ports first, so it never dies with "port in use", then:
//   • editable web UI (vite, hot reload) on :4096  ← open this; your LOCAL code, prod channel
//   • from-source API server            on :4097  ← internal; the UI calls it
//
// Everything runs in the prod channel: no DEV badge, prod default layout. Edit
// packages/app/src/** (or packages/ui/src/**) and the page hot-reloads.
// Ctrl-C (or either process dying) tears the whole thing down.
//
//   bun script/local.ts
//   bun script/local.ts --ui-port 4096 --api-port 4097
//   bun script/local.ts --hostname 0.0.0.0     # expose on the LAN
//   OPENCODE_CHANNEL=dev bun script/local.ts   # use the dev channel instead
//   bun script/local.ts --dry-run              # print the plan without running

import { parseArgs } from "node:util"
import { $ } from "bun"

const { values } = parseArgs({
  options: {
    "ui-port": { type: "string", default: "4096" },
    "api-port": { type: "string", default: "4097" },
    hostname: { type: "string", default: "127.0.0.1" },
    "dry-run": { type: "boolean", default: false },
  },
})

const uiPort = values["ui-port"]
const apiPort = values["api-port"]
const hostname = values.hostname
const appTargetHost = hostname === "0.0.0.0" ? "localhost" : hostname
const channel = process.env.OPENCODE_CHANNEL ?? "prod"

const RESET = "\x1b[0m"
const COLOR = { server: "\x1b[36m", app: "\x1b[35m", clean: "\x1b[33m" }

const targets = [
  {
    name: "server",
    color: COLOR.server,
    cmd: [
      "bun",
      "run",
      "--cwd",
      "packages/opencode",
      "--conditions=browser",
      "src/index.ts",
      "serve",
      "--port",
      apiPort,
      "--hostname",
      hostname,
    ],
    env: { OPENCODE_CHANNEL: channel } as Record<string, string>,
  },
  {
    name: "app",
    color: COLOR.app,
    cmd: ["bun", "run", "--cwd", "packages/app", "dev", "--", "--port", uiPort],
    env: { VITE_OPENCODE_SERVER_HOST: appTargetHost, VITE_OPENCODE_SERVER_PORT: apiPort, OPENCODE_CHANNEL: channel },
  },
]

if (values["dry-run"]) {
  console.log(`${COLOR.clean}[clean]${RESET} would free ports ${apiPort}, ${uiPort} + stale opencode dev processes`)
  for (const t of targets) {
    const env = Object.entries(t.env)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")
    console.log(`${t.color}[${t.name}]${RESET} ${env} ${t.cmd.join(" ")}`)
  }
  console.log(`\nOpen http://localhost:${uiPort}  (UI, channel=${channel}) — API on :${apiPort}`)
  process.exit(0)
}

await clearPorts()

const procs = targets.map((t) => {
  const child = Bun.spawn(t.cmd, {
    cwd: process.cwd(),
    env: { ...process.env, ...t.env },
    stdout: "pipe",
    stderr: "pipe",
  })
  void pump(child.stdout, t.color, t.name)
  void pump(child.stderr, t.color, t.name)
  return child
})

let shuttingDown = false
async function shutdown(code: number) {
  if (shuttingDown) return
  shuttingDown = true
  for (const p of procs) p.kill()
  await Promise.allSettled(procs.map((p) => p.exited))
  process.exit(code)
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void shutdown(0))

for (const [i, p] of procs.entries())
  void p.exited.then((code) => {
    console.log(`${targets[i].color}[${targets[i].name}]${RESET} exited with code ${code}`)
    void shutdown(code ?? 0)
  })

console.log(`\n${COLOR.app}➜ open  http://localhost:${uiPort}${RESET}  (your local UI, channel=${channel}, hot reload)`)
console.log(`${COLOR.server}  API   http://localhost:${apiPort}${RESET}\n`)

// Frees the UI + API ports and any stale opencode dev processes so a restart never collides.
async function clearPorts() {
  console.log(`${COLOR.clean}[clean]${RESET} freeing ports ${apiPort} + ${uiPort} and stale opencode dev processes…`)
  // Kill leftover orchestrators/servers/UIs by command pattern (never matches this script).
  for (const pattern of [
    "script/dev-all.ts",
    "script/prod-local.ts",
    "src/index.ts serve",
    "dist/opencode-.*serve",
    "packages/app dev",
    "node_modules/.bin/vite",
  ])
    await $`pkill -9 -f ${pattern}`.nothrow().quiet()
  // Kill whatever still holds the ports we need.
  for (const port of [apiPort, uiPort]) {
    const pids = (await $`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`.nothrow().quiet().text())
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const pid of pids) await $`kill -9 ${pid}`.nothrow().quiet()
  }
  await Bun.sleep(1500)
}

async function pump(stream: ReadableStream<Uint8Array>, color: string, name: string) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) process.stdout.write(`${color}[${name}]${RESET} ${line}\n`)
  }
  if (buffer) process.stdout.write(`${color}[${name}]${RESET} ${buffer}\n`)
}
