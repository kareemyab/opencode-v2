;(function () {
  var themeKey = "orgn-theme-id"
  var curatedKeyStorage = "orgn-curated-theme-key"
  var legacyThemeKey = "opencode-theme-id"
  var cacheVersionKey = "orgn-theme-cache-version"
  var expectedCacheVersion = "2"
  var defaultThemeId = "flexoki"
  var defaultCuratedKey = "flexoki-dark"
  var defaultScheme = "dark"

  if (localStorage.getItem(cacheVersionKey) !== expectedCacheVersion) {
    localStorage.setItem(cacheVersionKey, expectedCacheVersion)
    localStorage.removeItem("orgn-theme-css-light")
    localStorage.removeItem("orgn-theme-css-dark")
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }

  var themeId = localStorage.getItem(themeKey) || localStorage.getItem(legacyThemeKey) || defaultThemeId
  var curatedKey = localStorage.getItem(curatedKeyStorage) || defaultCuratedKey

  if (themeId === "oc-1" || themeId === "oc-2" || themeId === "orgn") {
    themeId = defaultThemeId
    curatedKey = defaultCuratedKey
    localStorage.setItem(themeKey, themeId)
    localStorage.setItem(curatedKeyStorage, curatedKey)
    localStorage.removeItem("orgn-theme-css-light")
    localStorage.removeItem("orgn-theme-css-dark")
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }

  var scheme =
    localStorage.getItem("orgn-color-scheme") || localStorage.getItem("opencode-color-scheme") || defaultScheme
  if (scheme !== "light" && scheme !== "dark" && scheme !== "system") scheme = defaultScheme
  var isDark = scheme === "dark" || (scheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  var mode = isDark ? "dark" : "light"

  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode

  var metas = document.querySelectorAll("meta[name='theme-color']")
  if (metas.length > 0) metas[0].setAttribute("content", isDark ? "#100f0f" : "#fffcf0")

  if (themeId === defaultThemeId && !localStorage.getItem("orgn-theme-css-" + mode)) return

  var css =
    localStorage.getItem("orgn-theme-css-" + mode) || localStorage.getItem("opencode-theme-css-" + mode)
  if (css) {
    var style = document.createElement("style")
    style.id = "oc-theme-preload"
    style.textContent =
      ":root{color-scheme:" +
      mode +
      ";--text-mix-blend-mode:" +
      (isDark ? "plus-lighter" : "multiply") +
      ";" +
      css +
      "}"
    document.head.appendChild(style)
  }
})()
