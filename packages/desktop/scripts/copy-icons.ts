import { $ } from "bun"
import { accessSync, constants } from "node:fs"
import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const src = `./icons/${channel}`
const dest = "resources/icons"

try {
  accessSync(dest, constants.W_OK)
  await $`rm -rf ${dest}`
  await $`cp -R ${src} ${dest}`
  console.log(`Copied ${channel} icons from ${src} to ${dest}`)
} catch {
  console.warn(`Skipping icon copy to ${dest} (not writable). Dev uses icons/${channel} directly.`)
}
