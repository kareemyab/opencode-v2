import type { ElectronAPI } from "../preload/types"

declare global {
  interface Window {
    api: ElectronAPI
    __ORGN__?: {
      deepLinks?: string[]
    }
    /** Legacy deep-link buffer — read-only fallback during transition. */
    __OPENCODE__?: {
      deepLinks?: string[]
    }
  }
}
