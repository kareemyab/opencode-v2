import { beforeEach, describe, expect, test } from "bun:test"

const src = await Bun.file(new URL("../public/oc-theme-preload.js", import.meta.url)).text()

const run = () => Function(src)()

beforeEach(() => {
  document.head.innerHTML = ""
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.removeAttribute("data-color-scheme")
  localStorage.clear()
  Object.defineProperty(window, "matchMedia", {
    value: () =>
      ({
        matches: false,
      }) as MediaQueryList,
    configurable: true,
  })
})

describe("theme preload", () => {
  test("migrates legacy oc-1 to flexoki dark before mount", () => {
    localStorage.setItem("opencode-theme-id", "oc-1")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#fff;")
    localStorage.setItem("opencode-theme-css-dark", "--background-base:#000;")

    run()

    expect(document.documentElement.dataset.theme).toBe("flexoki")
    expect(document.documentElement.dataset.colorScheme).toBe("dark")
    expect(localStorage.getItem("orgn-theme-id")).toBe("flexoki")
    expect(localStorage.getItem("orgn-curated-theme-key")).toBe("flexoki-dark")
    expect(localStorage.getItem("opencode-theme-css-light")).toBeNull()
    expect(localStorage.getItem("opencode-theme-css-dark")).toBeNull()
    expect(document.getElementById("oc-theme-preload")).toBeNull()
  })

  test("migrates legacy orgn theme id to flexoki", () => {
    localStorage.setItem("orgn-theme-id", "orgn")

    run()

    expect(document.documentElement.dataset.theme).toBe("flexoki")
    expect(localStorage.getItem("orgn-curated-theme-key")).toBe("flexoki-dark")
  })

  test("reads legacy theme id when orgn key is absent", () => {
    localStorage.setItem("orgn-theme-cache-version", "2")
    localStorage.setItem("opencode-theme-id", "nightowl")
    localStorage.setItem("orgn-color-scheme", "light")
    localStorage.setItem("opencode-theme-css-light", "--background-base:#fff;")

    run()

    expect(document.documentElement.dataset.theme).toBe("nightowl")
    expect(document.getElementById("oc-theme-preload")?.textContent).toContain("--background-base:#fff;")
  })

  test("defaults to flexoki on cold start", () => {
    run()

    expect(document.documentElement.dataset.theme).toBe("flexoki")
    expect(localStorage.getItem("orgn-curated-theme-key")).toBeNull()
    expect(document.getElementById("oc-theme-preload")).toBeNull()
  })

  test("invalidates stale theme css cache when version bumps", () => {
    localStorage.setItem("orgn-theme-cache-version", "1")
    localStorage.setItem("orgn-theme-css-dark", "--background-base:#000;")

    run()

    expect(localStorage.getItem("orgn-theme-cache-version")).toBe("2")
    expect(localStorage.getItem("orgn-theme-css-dark")).toBeNull()
  })
})
