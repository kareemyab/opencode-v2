import type { Part as PartType } from "@opencode-ai/sdk/v2"

const CONTEXT_GROUP_TOOLS = new Set(["read", "glob", "grep", "list"])
const SHELL_GROUP_TOOL = "bash"
const SHELL_GROUP_MIN = 3

export type PartRef = {
  messageID: string
  partID: string
}

export type PartGroup =
  | {
      key: string
      type: "part"
      ref: PartRef
    }
  | {
      key: string
      type: "context"
      refs: PartRef[]
    }
  | {
      key: string
      type: "shell"
      refs: PartRef[]
    }

function sameRef(a: PartRef, b: PartRef) {
  return a.messageID === b.messageID && a.partID === b.partID
}

function sameGroup(a: PartGroup, b: PartGroup) {
  if (a === b) return true
  if (a.key !== b.key) return false
  if (a.type !== b.type) return false
  if (a.type === "part") {
    if (b.type !== "part") return false
    return sameRef(a.ref, b.ref)
  }
  if (b.type === "part") return false
  if (a.refs.length !== b.refs.length) return false
  return a.refs.every((ref, i) => sameRef(ref, b.refs[i]!))
}

export function sameGroups(a: readonly PartGroup[] | undefined, b: readonly PartGroup[] | undefined) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((item, i) => sameGroup(item, b[i]!))
}

function isContextGroupTool(part: PartType) {
  return part.type === "tool" && CONTEXT_GROUP_TOOLS.has(part.tool)
}

function isShellGroupTool(part: PartType) {
  return part.type === "tool" && part.tool === SHELL_GROUP_TOOL
}

export function groupParts(parts: { messageID: string; part: PartType }[]) {
  const result: PartGroup[] = []
  let contextStart = -1
  let shellStart = -1

  const flushContext = (end: number) => {
    if (contextStart < 0) return
    const first = parts[contextStart]
    const last = parts[end]
    if (!first || !last) {
      contextStart = -1
      return
    }
    result.push({
      key: `context:${first.part.id}`,
      type: "context",
      refs: parts.slice(contextStart, end + 1).map((item) => ({
        messageID: item.messageID,
        partID: item.part.id,
      })),
    })
    contextStart = -1
  }

  const flushShell = (end: number) => {
    if (shellStart < 0) return
    const slice = parts.slice(shellStart, end + 1)
    const first = slice[0]
    if (!first) {
      shellStart = -1
      return
    }
    if (slice.length >= SHELL_GROUP_MIN) {
      result.push({
        key: `shell:${first.part.id}`,
        type: "shell",
        refs: slice.map((item) => ({
          messageID: item.messageID,
          partID: item.part.id,
        })),
      })
    } else {
      for (const item of slice) {
        result.push({
          key: `part:${item.messageID}:${item.part.id}`,
          type: "part",
          ref: {
            messageID: item.messageID,
            partID: item.part.id,
          },
        })
      }
    }
    shellStart = -1
  }

  parts.forEach((item, index) => {
    if (isContextGroupTool(item.part)) {
      flushShell(index - 1)
      if (contextStart < 0) contextStart = index
      return
    }

    if (isShellGroupTool(item.part)) {
      flushContext(index - 1)
      if (shellStart < 0) shellStart = index
      return
    }

    flushContext(index - 1)
    flushShell(index - 1)
    result.push({
      key: `part:${item.messageID}:${item.part.id}`,
      type: "part",
      ref: {
        messageID: item.messageID,
        partID: item.part.id,
      },
    })
  })

  flushContext(parts.length - 1)
  flushShell(parts.length - 1)
  return result
}
