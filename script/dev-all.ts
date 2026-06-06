#!/usr/bin/env bun
// Runs the opencode "web stack" locally in a single command:
//   1. the headless server (packages/opencode), from source, on --port (default 4096)
//   2. the SolidJS web app (packages/app) vite dev server, on --app-port (default 3000),
//      pointed at the server above via VITE_OPENCODE_SERVER_{HOST,PORT}
//
// Both run from source with hot reload. Press Ctrl-C (or let either crash) and the
// whole stack is torn down together.
//
//   bun script/dev-all.ts                     # server :4096, app :3000
//   bun script/dev-all.ts --port 8080         # server :8080, app points at it
//   bun script/dev-all.ts --app-port 4444     # app on :4444
//   bun script/dev-all.ts --hostname 0.0.0.0  # bind the server to all interfaces
//   bun script/dev-all.ts --dry-run           # print the commands without running them

import { parseArgs } from "node:util"

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4096" },
    "app-port": { type: "string", default: "3000" },
    hostname: { type: "string", default: "127.0.0.1" },
    "dry-run": { type: "boolean", default: false },
  },
})

const port = values.port
const appPort = values["app-port"]
const hostname = values.hostname
const appTargetHost = hostname === "0.0.0.0" ? "localhost" : hostname

const RESET = "\x1b[0m"
const targets = [
  {
    name: "server",
    color: "\x1b[36m", // cyan
    cmd: [
      "bun",
      "run",
      "--cwd",
      "packages/opencode",
      "--conditions=browser",
      "src/index.ts",
      "serve",
      "--port",
      port,
      "--hostname",
      hostname,
    ],
    env: {} as Record<string, string>,
  },
  {
    name: "app",
    color: "\x1b[35m", // magenta
    cmd: ["bun", "run", "--cwd", "packages/app", "dev", "--", "--port", appPort],
    env: { VITE_OPENCODE_SERVER_HOST: appTargetHost, VITE_OPENCODE_SERVER_PORT: port },
  },
]

if (values["dry-run"]) {
  for (const t of targets) {
    const env = Object.entries(t.env)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")
    console.log(`${t.color}[${t.name}]${RESET} ${env ? env + " " : ""}${t.cmd.join(" ")}`)
  }
  console.log(`\nApp:    http://localhost:${appPort}\nServer: http://localhost:${port}`)
  process.exit(0)
}

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

// If either process exits, tear down the whole stack so you never end up with a half-running stack.
for (const [i, p] of procs.entries())
  void p.exited.then((code) => {
    console.log(`${targets[i].color}[${targets[i].name}]${RESET} exited with code ${code}`)
    void shutdown(code ?? 0)
  })

console.log(`${targets[0].color}[server]${RESET} http://localhost:${port}`)
console.log(`${targets[1].color}[app]${RESET}    http://localhost:${appPort}\n`)

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
