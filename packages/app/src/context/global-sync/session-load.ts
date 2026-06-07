import type { Session } from "@opencode-ai/sdk/v2/client"
import type { RootLoadArgs } from "./types"

export async function loadDescendantSessions(input: {
  listChildren: (sessionID: string) => Promise<{ data?: Session[] }>
  parentIDs: string[]
  known: Set<string>
}) {
  const result: Session[] = []
  let queue = input.parentIDs.filter((id) => !!id)

  while (queue.length) {
    const batch = await Promise.all(queue.map((sessionID) => input.listChildren(sessionID)))
    const next: string[] = []
    for (const response of batch) {
      for (const child of response.data ?? []) {
        if (!child?.id || input.known.has(child.id)) continue
        input.known.add(child.id)
        result.push(child)
        next.push(child.id)
      }
    }
    queue = next
  }

  return result
}

export async function loadRootSessionsWithFallback(input: RootLoadArgs) {
  try {
    const result = await input.list({ directory: input.directory, roots: true, limit: input.limit })
    return {
      data: result.data,
      limit: input.limit,
      limited: true,
    } as const
  } catch {
    const result = await input.list({ directory: input.directory, roots: true })
    return {
      data: result.data,
      limit: input.limit,
      limited: false,
    } as const
  }
}

export function estimateRootSessionTotal(input: { count: number; limit: number; limited: boolean }) {
  if (!input.limited) return input.count
  if (input.count < input.limit) return input.count
  return input.count + 1
}
