import {
  APP_IDS,
  APP_NAMES,
  COMPANY_URL,
  PRODUCT_TAGLINE,
  SUPPORT_URL,
  type OrgnChannel,
} from "@opencode-ai/ui/brand"
import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel: OrgnChannel =
  arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = APP_IDS[channel]
const productName = APP_NAMES[channel]
const summary = `${PRODUCT_TAGLINE}${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="com.orgn">
    <name>orgn</name>
  </developer>

  <description>
    <p>
      orgn is a confidential agentic development environment. Run anything. See nothing.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="bugtracker">${SUPPORT_URL}</url>
  <url type="homepage">${COMPANY_URL}</url>
  <url type="help">${COMPANY_URL}/docs</url>

  <screenshots>
    <screenshot type="default">
      <image>${COMPANY_URL}/og.png</image>
    </screenshot>
  </screenshots>
</component>
`

const desktop = `[Desktop Entry]
Type=Application
Name=${productName}
GenericName=orgn
Comment=${PRODUCT_TAGLINE}
Exec=${productName} %U
Icon=${appId}
Categories=Development;IDE;
StartupWMClass=${productName}
Terminal=false
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)
await Bun.write(`resources/${appId}.desktop`, desktop)
console.log(`Generated Linux metadata for ${channel} at resources/${appId}.metainfo.xml and resources/${appId}.desktop`)
