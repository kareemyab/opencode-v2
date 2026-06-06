;(function () {
  var themeKey = "orgn-theme-id"
  var legacyThemeKey = "opencode-theme-id"
  var themeId = localStorage.getItem(themeKey) || localStorage.getItem(legacyThemeKey) || "orgn"

  if (themeId === "oc-1" || themeId === "oc-2") {
    themeId = "orgn"
    localStorage.setItem(themeKey, themeId)
    localStorage.removeItem("orgn-theme-css-light")
    localStorage.removeItem("orgn-theme-css-dark")
    localStorage.removeItem("opencode-theme-css-light")
    localStorage.removeItem("opencode-theme-css-dark")
  }

  var scheme =
    localStorage.getItem("orgn-color-scheme") || localStorage.getItem("opencode-color-scheme") || "system"
  var isDark = scheme === "dark" || (scheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  var mode = isDark ? "dark" : "light"

  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode

  var metas = document.querySelectorAll("meta[name='theme-color']")
  if (metas.length > 0) metas[0].setAttribute("content", isDark ? "#000000" : "#fafafa")

  if (themeId === "orgn") return

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
