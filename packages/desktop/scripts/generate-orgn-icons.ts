#!/usr/bin/env bun
/**
 * Generate orgn Electron + favicon raster assets from packages/ui/src/assets/orgn-app-icon.svg
 *
 * Usage: bun ./scripts/generate-orgn-icons.ts [dev|beta|prod|all|favicon]
 *
 * Requires: @resvg/resvg-js (devDependency). macOS: iconutil for .icns
 */

import { $ } from "bun"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Resvg } from "@resvg/resvg-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const sourceSvg = join(root, "../ui/src/assets/orgn-app-icon.svg")
const faviconSvg = join(root, "../ui/src/assets/favicon/orgn-favicon.svg")

const channels = ["dev", "beta", "prod"] as const
type Channel = (typeof channels)[number]

function renderPng(svgPath: string, size: number): Buffer {
  const svg = readFileSync(svgPath, "utf8")
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: size },
    background: "black",
  })
  return resvg.render().asPng()
}

function writePng(path: string, svgPath: string, size: number) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, renderPng(svgPath, size))
}

async function buildIco(pngPaths: string[], dest: string) {
  const toIco = (await import("to-ico")).default
  const images = pngPaths.map((p) => readFileSync(p))
  writeFileSync(dest, await toIco(images))
}

async function buildIcns(iconsetDir: string, dest: string) {
  if (process.platform !== "darwin") {
    console.warn("Skipping .icns generation (iconutil requires macOS)")
    return
  }
  await $`iconutil -c icns ${iconsetDir} -o ${dest}`
}

async function generateChannelIcons(channel: Channel) {
  const dest = join(root, "icons", channel)
  mkdirSync(dest, { recursive: true })

  const sizes: Array<[string, number]> = [
    ["32x32.png", 32],
    ["64x64.png", 64],
    ["128x128.png", 128],
    ["128x128@2x.png", 256],
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
    ["icon.png", 512],
    ["dock.png", 256],
  ]

  for (const [name, size] of sizes) {
    writePng(join(dest, name), sourceSvg, size)
  }

  const ico256 = join(dest, "256x256.png")
  writePng(ico256, sourceSvg, 256)
  await buildIco(
    [join(dest, "32x32.png"), join(dest, "64x64.png"), join(dest, "128x128.png"), ico256],
    join(dest, "icon.ico"),
  )

  const iconset = join(dest, "icon.iconset")
  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset, { recursive: true })

  const icnsMap: Array<[string, number]> = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024],
  ]

  for (const [name, size] of icnsMap) {
    writePng(join(iconset, name), sourceSvg, size)
  }

  await buildIcns(iconset, join(dest, "icon.icns"))
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
    writePng(join(dest, name), faviconSvg, size)
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
