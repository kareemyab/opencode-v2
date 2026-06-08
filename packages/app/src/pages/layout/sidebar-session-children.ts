import { createStore } from "solid-js/store"

const STORAGE_KEY = "opencode.sidebar.sessionChildren"

type State = {
  expanded: Record<string, boolean>
}

function read(): State {
  if (typeof localStorage === "undefined") return { expanded: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { expanded: {} }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { expanded: {} }
    const expanded = (parsed as { expanded?: unknown }).expanded
    if (!expanded || typeof expanded !== "object" || Array.isArray(expanded)) return { expanded: {} }
    return {
      expanded: Object.fromEntries(
        Object.entries(expanded).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
      ),
    }
  } catch {
    return { expanded: {} }
  }
}

function write(state: State) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota errors.
  }
}

const [store, setStore] = createStore<State>(read())

export const CHILD_COLLAPSE_THRESHOLD = 3

export function sessionChildrenKey(directory: string, sessionID: string) {
  return `${directory}:${sessionID}`
}

export function sessionChildrenExpanded(key: string) {
  return store.expanded[key]
}

export function setSessionChildrenExpanded(key: string, expanded: boolean) {
  setStore("expanded", key, expanded)
  write(store)
}
