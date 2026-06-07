#!/usr/bin/env bun
/**
 * macOS app icon: copy vscode-cde/resources/darwin/code.icns verbatim to icon.icns.
 * Windows/Linux rasters are generated from vscode-cde/resources/darwin/app-icon.svg.
 *
 * Usage: bun ./scripts/generate-orgn-icons.ts [dev|beta|prod|all|favicon]
 */

import { $ } from "bun"
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Resvg } from "@resvg/resvg-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const sourceSvg = join(root, "../../../vscode-cde/resources/darwin/app-icon.svg")
const sourceIcns = join(root, "../../../vscode-cde/resources/darwin/code.icns")

const channels = ["dev", "beta", "prod"] as const
type Channel = (typeof channels)[number]

function renderPng(size: number): Buffer {
  const svg = readFileSync(sourceSvg, "utf8")
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: size },
    background: "black",
  })
  return resvg.render().asPng()
}

function writePng(path: string, size: number) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderPng(size))
}

async function buildIco(pngPaths: string[], dest: string) {
  const toIco = (await import("to-ico")).default
  const images = pngPaths.map((p) => readFileSync(p))
  writeFileSync(dest, await toIco(images))
}

async function extractIcnsPngs(destIconset: string) {
  rmSync(destIconset, { recursive: true, force: true })
  mkdirSync(destIconset, { recursive: true })
  if (process.platform !== "darwin") return
  await $`iconutil --convert iconset --output ${destIconset} ${sourceIcns}`
}

async function generateChannelIcons(channel: Channel) {
  const dest = join(root, "icons", channel)
  mkdirSync(dest, { recursive: true })

  const iconset = join(dest, "vscode.iconset")
  await extractIcnsPngs(iconset)

  copyFileSync(sourceIcns, join(dest, "icon.icns"))

  const fromIcns: Array<[string, string]> = [
    ["32x32.png", "icon_32x32.png"],
    ["64x64.png", "icon_32x32@2x.png"],
    ["128x128.png", "icon_128x128.png"],
    ["128x128@2x.png", "icon_128x128@2x.png"],
    ["256x256.png", "icon_256x256.png"],
    ["icon.png", "icon_512x512.png"],
    ["dock.png", "icon_128x128@2x.png"],
  ]

  for (const [name, icnsName] of fromIcns) {
    copyFileSync(join(iconset, icnsName), join(dest, name))
  }

  const squareSizes: Array<[string, number]> = [
    ["Square30x30Logo.png", 30],
    ["Square44x44Logo.png", 44],
    ["Square71x71Logo.png", 71],
    ["Square89x89Logo.png", 89],
    ["Square107x107Logo.png", 107],
    ["Square142x142Logo.png", 142],
    ["Square150x150Logo.png", 150],
    ["Square284x284Logo.png", 284],
    ["Square310x310Logo.png", 310],
    ["StoreLogo.png", 50],
  ]

  for (const [name, size] of squareSizes) {
    writePng(join(dest, name), size)
  }

  const ico256 = join(dest, "256x256.png")
  await buildIco(
    [join(dest, "32x32.png"), join(dest, "64x64.png"), join(dest, "128x128.png"), ico256],
    join(dest, "icon.ico"),
  )

  rmSync(iconset, { recursive: true, force: true })
  console.log(`Generated ${channel} icons → ${dest}`)
}

async function generateFavicons() {
  const dest = join(root, "../ui/src/assets/favicon")
  const pairs: Array<[string, number]> = [
    ["orgn-favicon-96x96.png", 96],
    ["orgn-apple-touch-icon.png", 180],
    ["orgn-web-app-manifest-192x192.png", 192],
    ["orgn-web-app-manifest-512x512.png", 512],
  ]

  for (const [name, size] of pairs) {
    writePng(join(dest, name), size)
  }

  await buildIco(
    pairs.slice(0, 3).map(([name]) => join(dest, name)),
    join(dest, "orgn-favicon.ico"),
  )

  writeFileSync(
    join(dest, "orgn-site.webmanifest"),
    JSON.stringify(
      {
        name: "orgn",
        short_name: "orgn",
        icons: [
          { src: "/orgn-web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/orgn-web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
      },
      null,
      2,
    ),
  )

  console.log(`Generated favicons → ${dest}`)
}

async function main() {
  const target = process.argv[2] ?? "all"

  if (!existsSync(sourceSvg)) {
    throw new Error(`Missing source SVG: ${sourceSvg}`)
  }
  if (!existsSync(sourceIcns)) {
    throw new Error(`Missing source ICNS: ${sourceIcns}`)
  }

  if (target === "favicon") {
    await generateFavicons()
    return
  }

  if (target === "all") {
    for (const channel of channels) await generateChannelIcons(channel)
    await generateFavicons()
    return
  }

  if (!channels.includes(target as Channel)) {
    throw new Error(`Unknown target "${target}". Use dev|beta|prod|all|favicon`)
  }

  await generateChannelIcons(target as Channel)
}

await main()
